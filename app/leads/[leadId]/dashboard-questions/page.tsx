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
import { getLocale } from "@/lib/i18n-server";
import { pick } from "@/lib/i18n";

export default async function DashboardQuestionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ leadId: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { leadId } = await params;
  const { edit } = await searchParams;
  const locale = await getLocale();
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
        transcriptInput(locale),
        notesInput(notes, { href: `/leads/${leadId}/questions` }, locale),
        sourceSystemInput(lead.sourceSystem, locale),
        finalProposalInput(finalProposal.version, `/leads/${leadId}/proposal`, locale),
      ]}
      principles={QUESTIONS2_PRINCIPLES}
      locale={locale}
    />
  );
  const backToProposal = { href: `/leads/${leadId}/proposal`, label: pick(locale, "Proposal", "Voorstel") };

  if (lead.state === "proposal_finalized") {
    return (
      <div className="page-stack">
        <StepIntro title={pick(locale, "Dashboard questions", "Dashboardvragen")} />
        {contextPanel}
        <AutoGenerateCard
          title={pick(locale, "The AI prepares the dashboard", "De AI bereidt het dashboard voor")}
          description={pick(locale, "Based on the final proposal, the AI asks a few short questions to tailor the dashboard to this problem.", "Op basis van het definitieve voorstel stelt de AI enkele korte vragen om het dashboard op dit vraagstuk af te stemmen.")}
          url={`/api/leads/${leadId}/dashboard-questions`}
          label={pick(locale, "Generate questions", "Vragen genereren")}
          busyLabel={pick(locale, "Analyzing proposal...", "Voorstel analyseren...")}
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
        <StepIntro title={pick(locale, "Dashboard questions", "Dashboardvragen")}>
          {pick(locale, "Short answers are fine. If you don't know something, let the AI estimate it.", "Korte antwoorden zijn prima. Weet je iets niet, laat de AI dan een inschatting maken.")}
        </StepIntro>
        {contextPanel}
        <QuestionForm
          questions={questions}
          submitUrl={`/api/leads/${leadId}/dashboard-answers`}
          submitLabel={pick(locale, "Save and build dashboard →", "Opslaan en dashboard bouwen →")}
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
        <StepIntro title={pick(locale, "Edit dashboard answers", "Dashboardantwoorden bewerken")} />
        {hasLaterWork && (
          <StatusBlock tone="attention">
            {pick(locale, "After saving, the AI rebuilds the dashboard based on your new answers.", "Na het opslaan bouwt de AI het dashboard opnieuw op basis van je nieuwe antwoorden.")}
          </StatusBlock>
        )}
        <QuestionForm
          questions={questions}
          submitUrl={`/api/leads/${leadId}/dashboard-answers`}
          initialAnswers={answers}
          submitLabel={pick(locale, "Save and rebuild dashboard →", "Opslaan en dashboard opnieuw bouwen →")}
          redirectTo={`/leads/${leadId}/dashboard`}
          back={{ href: `/leads/${leadId}/dashboard-questions`, label: pick(locale, "Cancel", "Annuleren") }}
        />
      </div>
    );
  }

  return (
    <div className="page-stack">
      <StepIntro title={pick(locale, "Your dashboard answers", "Jouw dashboardantwoorden")} />
      {contextPanel}
      <AnswersSummary questions={questions} answers={answers} locale={locale} />
      <StepActions back={backToProposal}>
        <LinkButton href={`/leads/${leadId}/dashboard-questions?edit=1`} variant="secondary">
          {pick(locale, "Edit answers", "Antwoorden bewerken")}
        </LinkButton>
        <LinkButton href={`/leads/${leadId}/dashboard`}>{pick(locale, "Continue to dashboard", "Verder naar dashboard")} &rarr;</LinkButton>
      </StepActions>
    </div>
  );
}
