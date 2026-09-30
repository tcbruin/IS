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
import { getLocale } from "@/lib/i18n-server";
import { localeTag, pick } from "@/lib/i18n";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ leadId: string }>;
}) {
  const { leadId } = await params;
  const locale = await getLocale();
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
        transcriptInput(locale),
        notesInput(notes, { href: `/leads/${leadId}/questions` }, locale),
        sourceSystemInput(lead.sourceSystem, locale),
        finalProposalInput(finalProposal.version, `/leads/${leadId}/proposal`, locale),
        answersInput(pick(locale, "Answers to the dashboard questions", "Antwoorden op de dashboardvragen"), questions2, answers2, `/leads/${leadId}/dashboard-questions`, locale),
        sampleDataInput(locale),
      ]}
      principles={DASHBOARD_PRINCIPLES}
      locale={locale}
    />
  );
  const back = { href: `/leads/${leadId}/dashboard-questions`, label: pick(locale, "Dashboard questions", "Dashboardvragen") };
  const regenerate = (
    <GenerateButton
      url={`/api/leads/${leadId}/dashboard`}
      label={pick(locale, "Regenerate", "Opnieuw genereren")}
      busyLabel={pick(locale, "Designing dashboard...", "Dashboard ontwerpen...")}
      variant="secondary"
    />
  );

  if (lead.state === "questions2_answered") {
    return (
      <div className="page-stack">
        <StepIntro title={pick(locale, "PoC dashboard", "PoC-dashboard")} />
        {contextPanel}
        <AutoGenerateCard
          title={pick(locale, "The AI designs the dashboard", "De AI ontwerpt het dashboard")}
          description={pick(locale, "The AI chooses what is shown per row, per period and as KPIs for this one problem. The system fills it with illustrative sample data and calculates all figures itself.", "De AI kiest wat per rij, per periode en als KPI voor dit ene vraagstuk wordt getoond. Het systeem vult dit met illustratieve voorbeelddata en berekent alle cijfers zelf.")}
          url={`/api/leads/${leadId}/dashboard`}
          label={pick(locale, "Generate dashboard", "Dashboard genereren")}
          busyLabel={pick(locale, "Designing dashboard...", "Dashboard ontwerpen...")}
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
        <StepIntro title={pick(locale, "PoC dashboard", "PoC-dashboard")} />
        <Card>
          <h2 style={{ marginTop: 0 }}>{pick(locale, "This dashboard was made with an older version", "Dit dashboard is met een oudere versie gemaakt")}</h2>
          <p>
            {pick(locale, `That version showed generic sales figures with different labels. Regenerate it: the AI will then design a dashboard that truly fits ${lead.companyName}'s problem.`, `Die versie toonde algemene verkoopcijfers met andere labels. Genereer het opnieuw: de AI ontwerpt dan een dashboard dat echt bij het vraagstuk van ${lead.companyName} past.`)}
          </p>
          <GenerateButton url={`/api/leads/${leadId}/dashboard`} label={pick(locale, "Regenerate dashboard", "Dashboard opnieuw genereren")} busyLabel={pick(locale, "Designing dashboard...", "Dashboard ontwerpen...")} />
        </Card>
        <StepActions back={back} />
      </div>
    );
  }

  const units: Record<string, string> = {};
  for (const m of [...record.spec.model.measures, ...record.spec.model.derived]) units[m.key] = m.label;

  return (
    <div className="page-stack">
      <StepIntro title={pick(locale, "PoC dashboard", "PoC-dashboard")}>
        {pick(locale, "Feel free to click through the filters — the client receives exactly this interactive version.", "Klik gerust door de filters — de klant ontvangt precies deze interactieve versie.")}
      </StepIntro>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 20px", alignItems: "flex-start" }}>
        {contextPanel}
        {(record.spec.anchors.length > 0 || record.warnings.length > 0) && (
          <details className="disclosure no-print">
            <summary>
              {pick(locale, "Figures from the call", "Cijfers uit het gesprek")} · {record.spec.anchors.length} {pick(locale, "used", "gebruikt")}
              {record.warnings.length > 0 && `, ${record.warnings.length} ${record.warnings.length === 1 ? pick(locale, "note", "opmerking") : pick(locale, "notes", "opmerkingen")}`}
            </summary>
            <Card>
              {record.spec.anchors.length > 0 ? (
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 16 }}>
                  {record.spec.anchors.map((a, i) => (
                    <li key={i}>
                      <strong>
                        {a.kind === "count"
                          ? pick(locale, `Number of ${record.spec.model.entity.plural.toLowerCase()}`, `Aantal ${record.spec.model.entity.plural.toLowerCase()}`)
                          : a.kind === "threshold"
                            ? pick(locale, `Target for ${units[a.measure ?? ""] ?? a.measure}`, `Doel voor ${units[a.measure ?? ""] ?? a.measure}`)
                            : pick(locale, `Level of ${units[a.measure ?? ""] ?? a.measure}`, `Niveau van ${units[a.measure ?? ""] ?? a.measure}`)}
                        :
                      </strong>{" "}
                      {a.value.toLocaleString(localeTag(locale))} — &ldquo;{a.quote}&rdquo;
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ margin: 0, fontSize: 16 }}>{pick(locale, "No figures from the call were used; everything is illustrative.", "Er zijn geen cijfers uit het gesprek gebruikt; alles is illustratief.")}</p>
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
        <LinkButton href={`/leads/${leadId}/send`}>{pick(locale, "Continue to send", "Verder naar versturen")} &rarr;</LinkButton>
      </StepActions>
    </div>
  );
}
