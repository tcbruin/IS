import { NextResponse } from "next/server";
import {
  getConsultantNotes,
  getLead,
  getTranscriptText,
  transitionLead,
  writeQuestions,
} from "@/lib/leadStore";
import { assertTransition } from "@/lib/workflow";
import { generateClarifyingQuestions, llmContext } from "@/lib/llm";
import { extraInfoQuestion, normalizeQuestionIds } from "@/lib/validation";
import { handleApiError } from "@/lib/apiError";
import { logEvent, questionStats } from "@/lib/telemetry";
import { getLocale } from "@/lib/i18n-server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ leadId: string }> },
) {
  try {
    const { leadId } = await params;
    const locale = await getLocale();
    const lead = await getLead(leadId);
    assertTransition(lead.state, "generateQuestions1");

    const [transcript, notes] = await Promise.all([
      getTranscriptText(leadId),
      getConsultantNotes(leadId),
    ]);
    const generated = await generateClarifyingQuestions(
      { transcript, notes: notes ?? undefined, sourceSystem: lead.sourceSystem, locale },
      llmContext(lead),
    );
    const questions = [...normalizeQuestionIds(generated), extraInfoQuestion(locale)];

    await writeQuestions(leadId, 1, questions);
    await transitionLead(leadId, "generateQuestions1");
    await logEvent(leadId, { type: "questions_generated", round: 1, ...questionStats(questions) });

    return NextResponse.json({ questions });
  } catch (err) {
    return handleApiError(err);
  }
}
