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
        answersInput("Answers to the dashboard questions", questions2, answers2, `/leads/${leadId}/dashboard-questions`),
        sampleDataInput(),
      ]}
      principles={DASHBOARD_PRINCIPLES}
    />
  );
  const back = { href: `/leads/${leadId}/dashboard-questions`, label: "Dashboard questions" };
  const regenerate = (
    <GenerateButton
      url={`/api/leads/${leadId}/dashboard`}
      label="Regenerate"
      busyLabel="Designing dashboard..."
      variant="secondary"
    />
  );

  if (lead.state === "questions2_answered") {
    return (
      <div className="page-stack">
        <StepIntro title="PoC dashboard" />
        {contextPanel}
        <AutoGenerateCard
          title="The AI designs the dashboard"
          description="The AI chooses what is shown per row, per period and as KPIs for this one problem. The system fills it with illustrative sample data and calculates all figures itself."
          url={`/api/leads/${leadId}/dashboard`}
          label="Generate dashboard"
          busyLabel="Designing dashboard..."
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
          <h2 style={{ marginTop: 0 }}>This dashboard was made with an older version</h2>
          <p>
            That version showed generic sales figures with different labels. Regenerate it: the AI
            will then design a dashboard that truly fits {lead.companyName}'s problem.
          </p>
          <GenerateButton url={`/api/leads/${leadId}/dashboard`} label="Regenerate dashboard" busyLabel="Designing dashboard..." />
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
        Feel free to click through the filters — the client receives exactly this interactive version.
      </StepIntro>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 20px", alignItems: "flex-start" }}>
        {contextPanel}
        {(record.spec.anchors.length > 0 || record.warnings.length > 0) && (
          <details className="disclosure no-print">
            <summary>
              Figures from the call · {record.spec.anchors.length} used
              {record.warnings.length > 0 && `, ${record.warnings.length} ${record.warnings.length === 1 ? "note" : "notes"}`}
            </summary>
            <Card>
              {record.spec.anchors.length > 0 ? (
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 16 }}>
                  {record.spec.anchors.map((a, i) => (
                    <li key={i}>
                      <strong>
                        {a.kind === "count"
                          ? `Number of ${record.spec.model.entity.plural.toLowerCase()}`
                          : a.kind === "threshold"
                            ? `Target for ${units[a.measure ?? ""] ?? a.measure}`
                            : `Level of ${units[a.measure ?? ""] ?? a.measure}`}
                        :
                      </strong>{" "}
                      {a.value.toLocaleString("en-GB")} — &ldquo;{a.quote}&rdquo;
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ margin: 0, fontSize: 16 }}>No figures from the call were used; everything is illustrative.</p>
              )}
              {record.warnings.length > 0 && (
                <ul style={{ margin: "12px 0 0", paddingLeft: 20, fontSize: 15, opacity: 0.75 }}>
                  {record.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              )}
            </Card>
          </details>
        )}
      </div>
      <DashboardView record={record} companyName={lead.companyName} />
      <StepActions back={back}>
        {regenerate}
        <LinkButton href={`/leads/${leadId}/send`}>Continue to send &rarr;</LinkButton>
      </StepActions>
    </div>
  );
}
