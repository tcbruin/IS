import { getAnswers, getConsultantNotes, getLead, getQuestions, getTranscriptText } from "@/lib/leadStore";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { NotesEditor } from "@/components/ui/NotesEditor";
import { StatusBlock } from "@/components/ui/StatusBlock";
import { AIContextPanel } from "@/components/ui/AIContextPanel";
import { StepActions } from "@/components/ui/StepActions";
import { StepIntro } from "@/components/ui/StepIntro";
import { QuestionForm } from "@/components/questions/QuestionForm";
import { AnswersSummary } from "@/components/questions/AnswersSummary";
import { IntakeStep } from "@/components/questions/IntakeStep";
import { QUESTIONS1_PRINCIPLES, notesInput, sourceSystemInput, transcriptInput } from "@/lib/aiContext";
import { getDemoAnswers, getScenario } from "@/lib/demo";
import { getLocale } from "@/lib/i18n-server";
import { localeTag, pick } from "@/lib/i18n";

export default async function QuestionsPage({
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
  const [transcript, notes] = await Promise.all([getTranscriptText(leadId), getConsultantNotes(leadId)]);

  const contextPanel = (
    <AIContextPanel
      inputs={[transcriptInput(locale), notesInput(notes, undefined, locale), sourceSystemInput(lead.sourceSystem, locale)]}
      principles={QUESTIONS1_PRINCIPLES}
      locale={locale}
    />
  );
  const wordCount = transcript.split(/\s+/).filter(Boolean).length;
  const transcriptDisclosure = (
    <details className="disclosure">
      <summary>{pick(locale, "View transcript", "Transcript bekijken")} (±{wordCount.toLocaleString(localeTag(locale))} {pick(locale, "words", "woorden")})</summary>
      <Card>
        <p style={{ whiteSpace: "pre-wrap", margin: 0, fontSize: 16 }}>{transcript}</p>
      </Card>
    </details>
  );

  // 1.1 Transcript & notes
  if (lead.state === "transcript_uploaded") {
    return (
      <div className="page-stack">
        <StepIntro title={pick(locale, "Transcript & notes", "Transcript & notities")}>
          {pick(locale, "Add your own notes where needed. The AI will then ask a few short questions.", "Voeg waar nodig je eigen notities toe. De AI stelt daarna enkele korte vragen.")}
        </StepIntro>
        {contextPanel}
        {transcriptDisclosure}
        <IntakeStep leadId={leadId} notes={notes ?? ""} />
      </div>
    );
  }

  const questions = await getQuestions(leadId, 1);

  // 1.2 Answer questions (first time)
  if (lead.state === "questions1_generated") {
    const demoFill = lead.demo
      ? {
          answers: await getDemoAnswers(lead.demo.scenarioId, 1),
          briefing: (await getScenario(lead.demo.scenarioId))?.briefing ?? "",
        }
      : undefined;
    return (
      <div className="page-stack">
        <StepIntro title={pick(locale, "Answer questions", "Vragen beantwoorden")}>
          {pick(locale, "Short answers are fine. If you don't know something, let the AI estimate it.", "Korte antwoorden zijn prima. Weet je iets niet, laat de AI dan een inschatting maken.")}
        </StepIntro>
        {contextPanel}
        <QuestionForm
          questions={questions}
          submitUrl={`/api/leads/${leadId}/answers`}
          submitLabel={pick(locale, "Save and create proposal →", "Opslaan en voorstel maken →")}
          redirectTo={`/leads/${leadId}/proposal`}
          demoFill={demoFill}
        />
      </div>
    );
  }

  const answers = await getAnswers(leadId, 1);

  // Answers stay editable after the proposal/dashboard exist — a human feedback loop.
  // Resubmitting rewinds the lead to questions1_answered (see lib/workflow.ts), so the proposal
  // is regenerated right after.
  if (edit === "1") {
    const hasLaterWork = lead.state !== "questions1_answered";
    return (
      <div className="page-stack">
        <StepIntro title={pick(locale, "Edit answers", "Antwoorden bewerken")} />
        {hasLaterWork && (
          <StatusBlock tone="attention">
            {pick(locale, <>After saving, the AI regenerates the proposal based on your new answers. You will then need to review the current proposal{lead.state !== "proposal_generated" ? " and dashboard" : ""} again.</>, <>Na het opslaan maakt de AI het voorstel opnieuw op basis van je nieuwe antwoorden. Je moet daarna het huidige voorstel{lead.state !== "proposal_generated" ? " en dashboard" : ""} opnieuw beoordelen.</>)}
          </StatusBlock>
        )}
        <QuestionForm
          questions={questions}
          submitUrl={`/api/leads/${leadId}/answers`}
          initialAnswers={answers}
          submitLabel={pick(locale, "Save and regenerate proposal →", "Opslaan en voorstel opnieuw maken →")}
          redirectTo={`/leads/${leadId}/proposal`}
          back={{ href: `/leads/${leadId}/questions`, label: pick(locale, "Cancel", "Annuleren") }}
        />
      </div>
    );
  }

  return (
    <div className="page-stack">
      <StepIntro title={pick(locale, "Your answers", "Jouw antwoorden")} />
      {contextPanel}
      <AnswersSummary questions={questions} answers={answers} locale={locale} />
      {transcriptDisclosure}
      <details className="disclosure">
        <summary>{pick(locale, "Consultant notes", "Notities van consultant")}</summary>
        <Card variant="creme">
          <NotesEditor leadId={leadId} initialNotes={notes ?? ""} />
        </Card>
      </details>
      <StepActions>
        <LinkButton href={`/leads/${leadId}/questions?edit=1`} variant="secondary">
          {pick(locale, "Edit answers", "Antwoorden bewerken")}
        </LinkButton>
        <LinkButton href={`/leads/${leadId}/proposal`}>{pick(locale, "Continue to proposal", "Verder naar voorstel")} &rarr;</LinkButton>
      </StepActions>
    </div>
  );
}
