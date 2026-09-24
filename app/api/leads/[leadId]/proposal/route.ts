import { NextResponse } from "next/server";
import { z } from "zod";
import {
  appendProposalVersion,
  getAnswers,
  getConsultantNotes,
  getLatestProposalVersion,
  getLead,
  getQuestions,
  getTranscriptText,
  transitionLead,
} from "@/lib/leadStore";
import { assertTransition } from "@/lib/workflow";
import { generateProposal, llmContext } from "@/lib/llm";
import { getProposalExamples } from "@/lib/exampleLibrary";
import { parseSectionFeedback } from "@/lib/proposalSections";
import { handleApiError } from "@/lib/apiError";
import { logEvent } from "@/lib/telemetry";

const bodySchema = z.object({ feedback: z.string().optional() });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ leadId: string }> },
) {
  try {
    const { leadId } = await params;
    const lead = await getLead(leadId);
    assertTransition(lead.state, "generateProposal");

    const raw = await request.json().catch(() => ({}));
    const { feedback } = bodySchema.parse(raw);

    const [transcript, notes, questions, answers, priorVersion, examples] = await Promise.all([
      getTranscriptText(leadId),
      getConsultantNotes(leadId),
      getQuestions(leadId, 1),
      getAnswers(leadId, 1),
      getLatestProposalVersion(leadId),
      getProposalExamples(2, lead.companyName),
    ]);

    const { content, warnings } = await generateProposal(
      {
        transcript,
        notes: notes ?? undefined,
        sourceSystem: lead.sourceSystem,
        questions,
        answers,
        priorDraft: priorVersion?.content,
        feedback,
        examples,
      },
      llmContext(lead),
    );

    const version = await appendProposalVersion(leadId, {
      content,
      basedOnVersion: priorVersion?.version ?? null,
      feedback: feedback ?? null,
      warnings,
      source: "ai",
    });
    await transitionLead(leadId, "generateProposal");
    await logEvent(leadId, {
      type: "proposal_version_created",
      version: version.version,
      source: "ai",
      withFeedback: Boolean(feedback?.trim()),
      commentedSections: parseSectionFeedback(feedback),
      warnings: warnings.length,
    });

    return NextResponse.json(version);
  } catch (err) {
    return handleApiError(err);
  }
}
