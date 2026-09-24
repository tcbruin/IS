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

export default async function QuestionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ leadId: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { leadId } = await params;
  const { edit } = await searchParams;
  const lead = await getLead(leadId);
  const [transcript, notes] = await Promise.all([getTranscriptText(leadId), getConsultantNotes(leadId)]);

  const contextPanel = (
    <AIContextPanel
      inputs={[transcriptInput(), notesInput(notes), sourceSystemInput(lead.sourceSystem)]}
      principles={QUESTIONS1_PRINCIPLES}
    />
  );
  const wordCount = transcript.split(/\s+/).filter(Boolean).length;
  const transcriptDisclosure = (
    <details className="disclosure">
      <summary>Transcript bekijken (±{wordCount.toLocaleString("nl-NL")} woorden)</summary>
      <Card>
        <p style={{ whiteSpace: "pre-wrap", margin: 0, fontSize: 16 }}>{transcript}</p>
      </Card>
    </details>
  );

  // 1.1 Transcript & notities
  if (lead.state === "transcript_uploaded") {
    return (
      <div className="page-stack">
        <StepIntro title="Transcript & notities">
          Vul je eigen notities aan waar nodig. Daarna stelt de AI een paar korte vragen.
        </StepIntro>
        {contextPanel}
        {transcriptDisclosure}
        <IntakeStep leadId={leadId} notes={notes ?? ""} />
      </div>
    );
  }

  const questions = await getQuestions(leadId, 1);

  // 1.2 Vragen beantwoorden (first time)
  if (lead.state === "questions1_generated") {
    return (
      <div className="page-stack">
        <StepIntro title="Vragen beantwoorden">
          Kort is prima. Weet je iets niet, laat de AI het dan inschatten.
        </StepIntro>
        {contextPanel}
        <QuestionForm
          questions={questions}
          submitUrl={`/api/leads/${leadId}/answers`}
          submitLabel="Opslaan en voorstel maken →"
          redirectTo={`/leads/${leadId}/proposal`}
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
        <StepIntro title="Antwoorden aanpassen" />
        {hasLaterWork && (
          <StatusBlock tone="attention">
            Na opslaan maakt de AI het voorstel opnieuw op basis van je nieuwe antwoorden. Het
            huidige voorstel{lead.state !== "proposal_generated" ? " en dashboard" : ""} moet je
            daarna opnieuw doorlopen.
          </StatusBlock>
        )}
        <QuestionForm
          questions={questions}
          submitUrl={`/api/leads/${leadId}/answers`}
          initialAnswers={answers}
          submitLabel="Opslaan en voorstel opnieuw maken →"
          redirectTo={`/leads/${leadId}/proposal`}
          back={{ href: `/leads/${leadId}/questions`, label: "Annuleren" }}
        />
      </div>
    );
  }

  return (
    <div className="page-stack">
      <StepIntro title="Je antwoorden" />
      {contextPanel}
      <AnswersSummary questions={questions} answers={answers} />
      {transcriptDisclosure}
      <details className="disclosure">
        <summary>Notities van de consultant</summary>
        <Card variant="creme">
          <NotesEditor leadId={leadId} initialNotes={notes ?? ""} />
        </Card>
      </details>
      <StepActions>
        <LinkButton href={`/leads/${leadId}/questions?edit=1`} variant="secondary">
          Antwoorden aanpassen
        </LinkButton>
        <LinkButton href={`/leads/${leadId}/proposal`}>Verder naar voorstel &rarr;</LinkButton>
      </StepActions>
    </div>
  );
}
