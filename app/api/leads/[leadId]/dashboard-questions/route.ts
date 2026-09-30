import { NextResponse } from "next/server";
import {
  getConsultantNotes,
  getFinalProposalVersion,
  getLead,
  getTranscriptText,
  transitionLead,
  writeQuestions,
} from "@/lib/leadStore";
import { assertTransition } from "@/lib/workflow";
import { generateDashboardQuestions, llmContext } from "@/lib/llm";
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
    assertTransition(lead.state, "generateQuestions2");

    const [transcript, notes, finalProposal] = await Promise.all([
      getTranscriptText(leadId),
      getConsultantNotes(leadId),
      getFinalProposalVersion(leadId),
    ]);
    const generated = await generateDashboardQuestions(
      {
        transcript,
        notes: notes ?? undefined,
        sourceSystem: lead.sourceSystem,
        proposal: finalProposal.content,
        locale,
      },
      llmContext(lead),
    );
    const questions = [...normalizeQuestionIds(generated), extraInfoQuestion(locale)];

    await writeQuestions(leadId, 2, questions);
    await transitionLead(leadId, "generateQuestions2");
    await logEvent(leadId, { type: "questions_generated", round: 2, ...questionStats(questions) });

    return NextResponse.json({ questions });
  } catch (err) {
    return handleApiError(err);
  }
}
