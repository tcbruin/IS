import { redirect } from "next/navigation";
import { getAnswers, getConsultantNotes, getFinalProposalVersion, getLead, getQuestions } from "@/lib/leadStore";
import { isStateAtLeast } from "@/lib/workflow";
import {
  QUESTIONS2_PRINCIPLES,
  finalProposalInput,
  notesInput,
  sourceSystemInput,
  transcriptInput,
} from "@/lib/aiContext";
import { LinkButton } from "@/components/ui/Button";
import { StatusBlock } from "@/components/ui/StatusBlock";
import { AIContextPanel } from "@/components/ui/AIContextPanel";
import { AutoGenerateCard } from "@/components/ui/AutoGenerateCard";
import { StepActions } from "@/components/ui/StepActions";
import { StepIntro } from "@/components/ui/StepIntro";
import { QuestionForm } from "@/components/questions/QuestionForm";
import { AnswersSummary } from "@/components/questions/AnswersSummary";

export default async function DashboardQuestionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ leadId: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { leadId } = await params;
  const { edit } = await searchParams;
  const lead = await getLead(leadId);

  if (!isStateAtLeast(lead.state, "proposal_finalized")) {
    redirect(`/leads/${leadId}`);
  }

  const [notes, finalProposal] = await Promise.all([
    getConsultantNotes(leadId),
    getFinalProposalVersion(leadId),
  ]);
  const contextPanel = (
    <AIContextPanel
      inputs={[
        transcriptInput(),
        notesInput(notes, { href: `/leads/${leadId}/questions` }),
        sourceSystemInput(lead.sourceSystem),
        finalProposalInput(finalProposal.version, `/leads/${leadId}/proposal`),
      ]}
      principles={QUESTIONS2_PRINCIPLES}
    />
  );
  const backToProposal = { href: `/leads/${leadId}/proposal`, label: "Voorstel" };

  if (lead.state === "proposal_finalized") {
    return (
      <div className="page-stack">
        <StepIntro title="Dashboardvragen" />
        {contextPanel}
        <AutoGenerateCard
          title="De AI bereidt het dashboard voor"
          description="Op basis van het definitieve voorstel stelt de AI een paar korte vragen om het dashboard op dit probleem af te stemmen."
          url={`/api/leads/${leadId}/dashboard-questions`}
          label="Vragen genereren"
          busyLabel="Voorstel wordt geanalyseerd..."
        />
        <StepActions back={backToProposal} />
      </div>
    );
  }

  const questions = await getQuestions(leadId, 2);

  if (lead.state === "questions2_generated") {
    return (
      <div className="page-stack">
        <StepIntro title="Dashboardvragen">
          Kort is prima. Weet je iets niet, laat de AI het dan inschatten.
        </StepIntro>
        {contextPanel}
        <QuestionForm
          questions={questions}
          submitUrl={`/api/leads/${leadId}/dashboard-answers`}
          submitLabel="Opslaan en dashboard maken →"
          redirectTo={`/leads/${leadId}/dashboard`}
          back={backToProposal}
        />
      </div>
    );
  }

  const answers = await getAnswers(leadId, 2);

  // Stays editable after the dashboard exists — resubmitting rewinds to questions2_answered and
  // the dashboard is rebuilt right after.
  if (edit === "1") {
    const hasLaterWork = lead.state !== "questions2_answered";
    return (
      <div className="page-stack">
        <StepIntro title="Dashboardantwoorden aanpassen" />
        {hasLaterWork && (
          <StatusBlock tone="attention">
            Na opslaan bouwt de AI het dashboard opnieuw op basis van je nieuwe antwoorden.
          </StatusBlock>
        )}
        <QuestionForm
          questions={questions}
          submitUrl={`/api/leads/${leadId}/dashboard-answers`}
          initialAnswers={answers}
          submitLabel="Opslaan en dashboard opnieuw maken →"
          redirectTo={`/leads/${leadId}/dashboard`}
          back={{ href: `/leads/${leadId}/dashboard-questions`, label: "Annuleren" }}
        />
      </div>
    );
  }

  return (
    <div className="page-stack">
      <StepIntro title="Je dashboardantwoorden" />
      {contextPanel}
      <AnswersSummary questions={questions} answers={answers} />
      <StepActions back={backToProposal}>
        <LinkButton href={`/leads/${leadId}/dashboard-questions?edit=1`} variant="secondary">
          Antwoorden aanpassen
        </LinkButton>
        <LinkButton href={`/leads/${leadId}/dashboard`}>Verder naar dashboard &rarr;</LinkButton>
      </StepActions>
    </div>
  );
}
