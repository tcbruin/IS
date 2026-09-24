import { NextResponse } from "next/server";
import {
  getAnswers,
  getConsultantNotes,
  getFinalProposalVersion,
  getLead,
  getQuestions,
  getTranscriptText,
  transitionLead,
  writeDashboard,
} from "@/lib/leadStore";
import { assertTransition } from "@/lib/workflow";
import { generateDashboard, llmContext } from "@/lib/llm";
import { handleApiError } from "@/lib/apiError";
import { logEvent } from "@/lib/telemetry";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ leadId: string }> },
) {
  try {
    const { leadId } = await params;
    const lead = await getLead(leadId);
    assertTransition(lead.state, "generateDashboard");

    const [transcript, notes, finalProposal, questions, answers] = await Promise.all([
      getTranscriptText(leadId),
      getConsultantNotes(leadId),
      getFinalProposalVersion(leadId),
      getQuestions(leadId, 2),
      getAnswers(leadId, 2),
    ]);

    // Seed = lead id: regenerating keeps the same random stream, so only the AI's design
    // changes the numbers, not chance.
    const build = { seed: leadId, generatedAt: new Date().toISOString() };
    const { spec, warnings } = await generateDashboard(
      {
        transcript,
        notes: notes ?? undefined,
        sourceSystem: lead.sourceSystem,
        proposal: finalProposal.content,
        questions,
        answers,
      },
      llmContext(lead),
      build,
    );

    await writeDashboard(leadId, { version: 2, spec, ...build, warnings });
    await transitionLead(leadId, "generateDashboard");
    await logEvent(leadId, {
      type: "dashboard_generated",
      regeneration: lead.state !== "questions2_answered",
      warnings: warnings.length,
    });

    return NextResponse.json({ ok: true, warnings });
  } catch (err) {
    return handleApiError(err);
  }
}
