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
    assertTransition(lead.state, "submitAnswers1");

    const body = answersSchema.parse(await request.json());
    await writeAnswers(leadId, 1, body.answers);
    await transitionLead(leadId, "submitAnswers1");
    await logEvent(leadId, {
      type: "answers_submitted",
      round: 1,
      ...answerStats(body.answers),
      isResubmit: lead.state !== "questions1_generated",
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
