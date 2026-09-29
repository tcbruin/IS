import { NextResponse } from "next/server";
import {
  appendProposalVersion,
  getLead,
  getProposalCurrent,
  getProposalVersion,
} from "@/lib/leadStore";
import { assertTransition } from "@/lib/workflow";
import { proposalContentSchema, proposalEditRequestSchema, type ProposalVersion } from "@/lib/validation";
import { normalizeProposalContent } from "@/lib/proposalDocument";
import { applyProposalGuardrails } from "@/lib/guardrails";
import { computeEditStats } from "@/lib/editMetrics";
import { handleApiError } from "@/lib/apiError";
import { logEvent } from "@/lib/telemetry";

/** Walks the basedOn chain back to the nearest AI-written version (the draft the human is
 * editing), or null if the chain contains none. */
async function findAiAncestor(leadId: string, from: ProposalVersion): Promise<ProposalVersion | null> {
  let v: ProposalVersion | null = from;
  for (let guard = 0; v && guard < 100; guard++) {
    if (v.source === "ai") return v;
    v = v.basedOnVersion ? await getProposalVersion(leadId, v.basedOnVersion) : null;
  }
  return null;
}

/** Saves a manually edited proposal as a new version (source "manual"). */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ leadId: string }> },
) {
  try {
    const { leadId } = await params;
    const lead = await getLead(leadId);
    assertTransition(lead.state, "editProposal");

    const body = proposalEditRequestSchema.parse(await request.json());
    const content = proposalContentSchema.parse(normalizeProposalContent(body.content));

    const current = await getProposalCurrent(leadId);
    if (body.basedOnVersion !== current.latestVersion && !body.force) {
      return NextResponse.json(
        {
          error: `A newer version (v${current.latestVersion}) has been saved in the meantime. Your changes are based on v${body.basedOnVersion}.`,
          code: "stale_version",
          latestVersion: current.latestVersion,
        },
        { status: 409 },
      );
    }

    const base = await getProposalVersion(leadId, body.basedOnVersion);
    if (JSON.stringify(normalizeProposalContent(base.content)) === JSON.stringify(content)) {
      return NextResponse.json({ ...base, unchanged: true });
    }

    const { content: fixed, warnings } = applyProposalGuardrails(content, { source: "manual" });
    const vsBase = computeEditStats(base.content, fixed);
    const aiAncestor = await findAiAncestor(leadId, base);
    const vsAi = aiAncestor ? computeEditStats(aiAncestor.content, fixed) : null;

    const version = await appendProposalVersion(leadId, {
      content: fixed,
      basedOnVersion: base.version,
      feedback: null,
      warnings,
      source: "manual",
      editStats: {
        comparedToVersion: base.version,
        changedPct: vsBase.changedPct,
        aiVersion: aiAncestor?.version ?? null,
        changedPctVsAi: vsAi?.changedPct ?? null,
        sectionsChanged: vsBase.sectionsChanged,
      },
    });
    await logEvent(leadId, {
      type: "proposal_version_created",
      version: version.version,
      source: "manual",
      withFeedback: false,
      commentedSections: [],
      warnings: warnings.length,
      changedPct: vsBase.changedPct,
      changedPctVsAi: vsAi?.changedPct ?? null,
    });

    return NextResponse.json(version);
  } catch (err) {
    return handleApiError(err);
  }
}
