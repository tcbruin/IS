import { NextResponse } from "next/server";
import { z } from "zod";
import {
  finalizeProposalVersion,
  getLead,
  getProposalVersion,
  listProposalVersions,
  transitionLead,
} from "@/lib/leadStore";
import { assertTransition } from "@/lib/workflow";
import { saveProposalExample } from "@/lib/exampleLibrary";
import { handleApiError } from "@/lib/apiError";
import { logEvent } from "@/lib/telemetry";

const bodySchema = z.object({ version: z.number().int().positive() });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ leadId: string }> },
) {
  try {
    const { leadId } = await params;
    const lead = await getLead(leadId);
    assertTransition(lead.state, "finalizeProposal");

    const { version } = bodySchema.parse(await request.json());
    const finalized = await getProposalVersion(leadId, version);
    await finalizeProposalVersion(leadId, version);
    await transitionLead(leadId, "finalizeProposal");

    const versions = await listProposalVersions(leadId);
    await logEvent(leadId, {
      type: "proposal_finalized",
      version,
      aiVersions: versions.filter((v) => v.source === "ai").length,
      manualVersions: versions.filter((v) => v.source === "manual").length,
    });

    // Grows the example library for future proposal generations. Best-effort: a failure here
    // shouldn't block finalizing, which already succeeded above. Demo leads are skipped so
    // rehearsing a scenario never feeds its own proposal back into later prompts.
    if (!lead.demo) {
      await saveProposalExample({
        leadId,
        companyName: lead.companyName,
        content: finalized.content,
      }).catch(() => {});
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
