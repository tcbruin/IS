import { NextResponse } from "next/server";
import { getLead, transitionLead, writeAnswers } from "@/lib/leadStore";
import { assertTransition } from "@/lib/workflow";
import { answersSchema } from "@/lib/validation";
import { handleApiError } from "@/lib/apiError";
import { answerStats, logEvent } from "@/lib/telemetry";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ leadId: string }> },
) {
  try {
    const { leadId } = await params;
    const lead = await getLead(leadId);
    assertTransition(lead.state, "submitAnswers2");

    const body = answersSchema.parse(await request.json());
    await writeAnswers(leadId, 2, body.answers);
    await transitionLead(leadId, "submitAnswers2");
    await logEvent(leadId, {
      type: "answers_submitted",
      round: 2,
      ...answerStats(body.answers),
      isResubmit: lead.state !== "questions2_generated",
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
