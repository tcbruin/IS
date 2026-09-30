import { redirect } from "next/navigation";
import {
  getAnswers,
  getConsultantNotes,
  getLead,
  getProposalCurrent,
  getProposalVersion,
  getQuestions,
  listProposalVersions,
} from "@/lib/leadStore";
import { getProposalExamples } from "@/lib/exampleLibrary";
import { getDemoFeedback } from "@/lib/demo";
import { isStateAtLeast } from "@/lib/workflow";
import { formatDocumentDate } from "@/lib/proposalLayout";
import {
  PROPOSAL_EXAMPLES_PRINCIPLE,
  PROPOSAL_PRINCIPLES,
  answersInput,
  examplesInput,
  notesInput,
  sourceSystemInput,
  transcriptInput,
} from "@/lib/aiContext";
import { AutoGenerateCard } from "@/components/ui/AutoGenerateCard";
import { AIContextPanel } from "@/components/ui/AIContextPanel";
import { StepActions } from "@/components/ui/StepActions";
import { StepIntro } from "@/components/ui/StepIntro";
import { ProposalWorkspace } from "@/components/proposal/ProposalWorkspace";
import { VersionHistoryPanel } from "@/components/proposal/VersionHistoryPanel";
import { getLocale } from "@/lib/i18n-server";
import { pick } from "@/lib/i18n";

export default async function ProposalPage({
  params,
  searchParams,
}: {
  params: Promise<{ leadId: string }>;
  searchParams: Promise<{ version?: string }>;
}) {
  const { leadId } = await params;
  const { version: versionParam } = await searchParams;
  const locale = await getLocale();
  const lead = await getLead(leadId);

  if (!isStateAtLeast(lead.state, "questions1_answered")) {
    redirect(`/leads/${leadId}`);
  }

  const [notes, questions, answers, examples] = await Promise.all([
    getConsultantNotes(leadId),
    getQuestions(leadId, 1),
    getAnswers(leadId, 1),
    getProposalExamples(2, lead.companyName),
  ]);
  const contextPanel = (
    <AIContextPanel
      inputs={[
        transcriptInput(locale),
        notesInput(notes, { href: `/leads/${leadId}/questions` }, locale),
        sourceSystemInput(lead.sourceSystem, locale),
        answersInput(pick(locale, "Answers to the clarifying questions", "Antwoorden op de verduidelijkende vragen"), questions, answers, `/leads/${leadId}/questions`, locale),
        examplesInput(examples.length, locale),
      ]}
      principles={examples.length > 0 ? [...PROPOSAL_PRINCIPLES, PROPOSAL_EXAMPLES_PRINCIPLE] : PROPOSAL_PRINCIPLES}
      locale={locale}
    />
  );

  if (lead.state === "questions1_answered") {
    return (
      <div className="page-stack">
        <StepIntro title={pick(locale, "Proposal", "Voorstel")} />
        {contextPanel}
        <AutoGenerateCard
          title={pick(locale, "The AI writes the draft", "De AI schrijft het concept")}
          description={pick(locale, "Based on the call, your notes and your answers. Afterwards you can edit it yourself or ask the AI for changes.", "Op basis van het gesprek, je notities en je antwoorden. Daarna kun je het zelf bewerken of de AI om wijzigingen vragen.")}
          url={`/api/leads/${leadId}/proposal`}
          label={pick(locale, "Generate proposal", "Voorstel genereren")}
          busyLabel={pick(locale, "Writing proposal...", "Voorstel schrijven...")}
        />
        <StepActions back={{ href: `/leads/${leadId}/questions`, label: pick(locale, "Questions", "Vragen") }} />
      </div>
    );
  }

  const [current, versions] = await Promise.all([getProposalCurrent(leadId), listProposalVersions(leadId)]);
  const finalized = isStateAtLeast(lead.state, "proposal_finalized") && current.finalVersion !== null;
  const defaultVersion = finalized ? current.finalVersion! : current.latestVersion;
  const requested = Number(versionParam);
  const activeVersion =
    Number.isInteger(requested) && requested >= 1 && requested <= current.latestVersion ? requested : defaultVersion;
  const version = await getProposalVersion(leadId, activeVersion);
  const mode = activeVersion !== defaultVersion ? "old" : finalized ? "final" : "edit";
  const demoFeedback = lead.demo ? await getDemoFeedback(lead.demo.scenarioId) : null;

  return (
    <ProposalWorkspace
      // Remount when switching versions via ?version=, so the editor never mixes two versions.
      key={`${mode}-${activeVersion === defaultVersion ? "current" : activeVersion}`}
      leadId={leadId}
      companyName={lead.companyName}
      mode={mode}
      version={version}
      isSent={lead.state === "sent"}
      dateLabel={formatDocumentDate(version.createdAt, locale)}
      contextPanel={contextPanel}
      demoFeedback={demoFeedback}
      historyPanel={
        <VersionHistoryPanel
          leadId={leadId}
          versions={versions}
          activeVersion={activeVersion}
          finalVersion={current.finalVersion}
        />
      }
    />
  );
}
