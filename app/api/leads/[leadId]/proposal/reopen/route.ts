import { NextResponse } from "next/server";
import { getLead, reopenProposal, transitionLead } from "@/lib/leadStore";
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
    assertTransition(lead.state, "reopenProposal");

    await reopenProposal(leadId);
    await transitionLead(leadId, "reopenProposal");
    await logEvent(leadId, { type: "proposal_reopened", fromState: lead.state });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
