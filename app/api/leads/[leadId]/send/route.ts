import { NextResponse } from "next/server";
import { getLead, transitionLead } from "@/lib/leadStore";
import { assertTransition } from "@/lib/workflow";
import { handleApiError } from "@/lib/apiError";
import { logEvent } from "@/lib/telemetry";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ leadId: string }> },
) {
  try {
    const { leadId } = await params;
    const lead = await getLead(leadId);
    assertTransition(lead.state, "markSent");

    await transitionLead(leadId, "markSent");
    await logEvent(leadId, { type: "marked_sent" });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
