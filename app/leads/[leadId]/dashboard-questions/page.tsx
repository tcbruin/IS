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
import { getDemoAnswers, getScenario } from "@/lib/demo";

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
  const backToProposal = { href: `/leads/${leadId}/proposal`, label: "Proposal" };

  if (lead.state === "proposal_finalized") {
    return (
      <div className="page-stack">
        <StepIntro title="Dashboard questions" />
        {contextPanel}
        <AutoGenerateCard
          title="The AI prepares the dashboard"
          description="Based on the final proposal, the AI asks a few short questions to tailor the dashboard to this problem."
          url={`/api/leads/${leadId}/dashboard-questions`}
          label="Generate questions"
          busyLabel="Analyzing proposal..."
        />
        <StepActions back={backToProposal} />
      </div>
    );
  }

  const questions = await getQuestions(leadId, 2);

  if (lead.state === "questions2_generated") {
    const demoFill = lead.demo
      ? {
          answers: await getDemoAnswers(lead.demo.scenarioId, 2),
          briefing: (await getScenario(lead.demo.scenarioId))?.briefing ?? "",
        }
      : undefined;
    return (
      <div className="page-stack">
        <StepIntro title="Dashboard questions">
          Short answers are fine. If you don't know something, let the AI estimate it.
        </StepIntro>
        {contextPanel}
        <QuestionForm
          questions={questions}
          submitUrl={`/api/leads/${leadId}/dashboard-answers`}
          submitLabel="Save and build dashboard →"
          redirectTo={`/leads/${leadId}/dashboard`}
          back={backToProposal}
          demoFill={demoFill}
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
        <StepIntro title="Edit dashboard answers" />
        {hasLaterWork && (
          <StatusBlock tone="attention">
            After saving, the AI rebuilds the dashboard based on your new answers.
          </StatusBlock>
        )}
        <QuestionForm
          questions={questions}
          submitUrl={`/api/leads/${leadId}/dashboard-answers`}
          initialAnswers={answers}
          submitLabel="Save and rebuild dashboard →"
          redirectTo={`/leads/${leadId}/dashboard`}
          back={{ href: `/leads/${leadId}/dashboard-questions`, label: "Cancel" }}
        />
      </div>
    );
  }

  return (
    <div className="page-stack">
      <StepIntro title="Your dashboard answers" />
      {contextPanel}
      <AnswersSummary questions={questions} answers={answers} />
      <StepActions back={backToProposal}>
        <LinkButton href={`/leads/${leadId}/dashboard-questions?edit=1`} variant="secondary">
          Edit answers
        </LinkButton>
        <LinkButton href={`/leads/${leadId}/dashboard`}>Continue to dashboard &rarr;</LinkButton>
      </StepActions>
    </div>
  );
}
