import { redirect } from "next/navigation";
import {
  LegacyDashboardError,
  getAnswers,
  getConsultantNotes,
  getDashboard,
  getFinalProposalVersion,
  getLead,
  getQuestions,
} from "@/lib/leadStore";
import { isStateAtLeast } from "@/lib/workflow";
import {
  DASHBOARD_PRINCIPLES,
  answersInput,
  finalProposalInput,
  notesInput,
  sampleDataInput,
  sourceSystemInput,
  transcriptInput,
} from "@/lib/aiContext";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { GenerateButton } from "@/components/ui/GenerateButton";
import { StatusBlock } from "@/components/ui/StatusBlock";
import { AIContextPanel } from "@/components/ui/AIContextPanel";
import { AutoGenerateCard } from "@/components/ui/AutoGenerateCard";
import { StepActions } from "@/components/ui/StepActions";
import { StepIntro } from "@/components/ui/StepIntro";
import { DashboardView } from "@/components/dashboard/DashboardView";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ leadId: string }>;
}) {
  const { leadId } = await params;
  const lead = await getLead(leadId);

  if (!isStateAtLeast(lead.state, "questions2_answered")) {
    redirect(`/leads/${leadId}`);
  }

  const [notes, finalProposal, questions2, answers2] = await Promise.all([
    getConsultantNotes(leadId),
    getFinalProposalVersion(leadId),
    getQuestions(leadId, 2),
    getAnswers(leadId, 2),
  ]);
  const contextPanel = (
    <AIContextPanel
      inputs={[
        transcriptInput(),
        notesInput(notes, { href: `/leads/${leadId}/questions` }),
        sourceSystemInput(lead.sourceSystem),
        finalProposalInput(finalProposal.version, `/leads/${leadId}/proposal`),
        answersInput("Antwoorden op de dashboardvragen", questions2, answers2, `/leads/${leadId}/dashboard-questions`),
        sampleDataInput(),
      ]}
      principles={DASHBOARD_PRINCIPLES}
    />
  );
  const back = { href: `/leads/${leadId}/dashboard-questions`, label: "Dashboardvragen" };
  const regenerate = (
    <GenerateButton
      url={`/api/leads/${leadId}/dashboard`}
      label="Opnieuw genereren"
      busyLabel="Dashboard wordt ontworpen..."
      variant="secondary"
    />
  );

  if (lead.state === "questions2_answered") {
    return (
      <div className="page-stack">
        <StepIntro title="PoC dashboard" />
        {contextPanel}
        <AutoGenerateCard
          title="De AI ontwerpt het dashboard"
          description="De AI kiest wat er per rij, per periode en als KPI getoond wordt voor dit ene probleem. Het systeem vult het met illustratieve voorbeelddata en rekent alle cijfers zelf uit."
          url={`/api/leads/${leadId}/dashboard`}
          label="Dashboard genereren"
          busyLabel="Dashboard wordt ontworpen..."
        />
        <StepActions back={back} />
      </div>
    );
  }

  const record = await getDashboard(leadId).catch((err) => {
    if (err instanceof LegacyDashboardError) return null;
    throw err;
  });

  if (!record) {
    return (
      <div className="page-stack">
        <StepIntro title="PoC dashboard" />
        <Card>
          <h2 style={{ marginTop: 0 }}>Dit dashboard is met een oudere versie gemaakt</h2>
          <p>
            Die versie toonde algemene verkoopcijfers met andere labels. Genereer het opnieuw: de AI
            ontwerpt dan een dashboard dat echt bij het probleem van {lead.companyName} past.
          </p>
          <GenerateButton url={`/api/leads/${leadId}/dashboard`} label="Dashboard opnieuw genereren" busyLabel="Dashboard wordt ontworpen..." />
        </Card>
        <StepActions back={back} />
      </div>
    );
  }

  const units: Record<string, string> = {};
  for (const m of [...record.spec.model.measures, ...record.spec.model.derived]) units[m.key] = m.label;

  return (
    <div className="page-stack">
      <StepIntro title="PoC dashboard">
        Klik gerust door de filters — de klant krijgt precies deze interactieve versie mee.
      </StepIntro>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 20px" }}>
        {contextPanel}
        {record.spec.anchors.length > 0 && (
          <details className="disclosure no-print">
            <summary>Cijfers uit het gesprek ({record.spec.anchors.length})</summary>
            <Card>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 16 }}>
                {record.spec.anchors.map((a, i) => (
                  <li key={i}>
                    <strong>
                      {a.kind === "count"
                        ? `Aantal ${record.spec.model.entity.plural.toLowerCase()}`
                        : a.kind === "threshold"
                          ? `Norm voor ${units[a.measure ?? ""] ?? a.measure}`
                          : `Niveau van ${units[a.measure ?? ""] ?? a.measure}`}
                      :
                    </strong>{" "}
                    {a.value.toLocaleString("nl-NL")} — &ldquo;{a.quote}&rdquo;
                  </li>
                ))}
              </ul>
            </Card>
          </details>
        )}
      </div>
      {record.warnings.length > 0 && <StatusBlock tone="attention">{record.warnings.join(" ")}</StatusBlock>}
      <DashboardView record={record} companyName={lead.companyName} />
      <StepActions back={back}>
        {regenerate}
        <LinkButton href={`/leads/${leadId}/send`}>Verder naar versturen &rarr;</LinkButton>
      </StepActions>
    </div>
  );
}
