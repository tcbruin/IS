import { NextResponse } from "next/server";
import { getDashboard, getFinalProposalVersion, getLead, writeCoverEmail } from "@/lib/leadStore";
import { isStateAtLeast, WorkflowError } from "@/lib/workflow";
import { generateCoverEmail, llmContext } from "@/lib/llm";
import { handleApiError } from "@/lib/apiError";
import { logEvent } from "@/lib/telemetry";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ leadId: string }> },
) {
  try {
    const { leadId } = await params;
    const lead = await getLead(leadId);
    if (!isStateAtLeast(lead.state, "dashboard_generated")) {
      throw new WorkflowError("The proposal and dashboard must be completed first.");
    }

    const [finalProposal, dashboard] = await Promise.all([
      getFinalProposalVersion(leadId),
      getDashboard(leadId),
    ]);

    const email = await generateCoverEmail(
      {
        companyName: lead.companyName,
        leadName: lead.leadName,
        proposalIntro: finalProposal.content.coverIntro,
        proposalNextSteps: finalProposal.content.nextSteps,
        dashboardTitle: dashboard.spec.title,
      },
      llmContext(lead),
    );

    await writeCoverEmail(leadId, email);
    await logEvent(leadId, { type: "cover_email_generated" });

    return NextResponse.json(email);
  } catch (err) {
    return handleApiError(err);
  }
}
