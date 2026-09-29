import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getAnswers,
  getCoverEmail,
  getDashboard,
  getLead,
  getQuestions,
  listProposalVersions,
} from "@/lib/leadStore";
import { isStateAtLeast, WorkflowError } from "@/lib/workflow";
import { writeRecording } from "@/lib/demo";
import { splitSectionFeedback } from "@/lib/proposalSections";
import { EXTRA_INFO_QUESTION } from "@/lib/validation";
import { llmModel, PROMPT_VERSIONS } from "@/lib/llm";
import { handleApiError } from "@/lib/apiError";

const bodySchema = z.object({ leadId: z.string() });

/**
 * "Save as demo recording": turns a completed live demo run into the recording that fast
 * demos of that scenario replay — the AI outputs in call order, plus the answers and feedback
 * that were used, so "Fill in demo answers" lines up with the recorded questions by id.
 */
export async function POST(request: Request) {
  try {
    const { leadId } = bodySchema.parse(await request.json());
    const lead = await getLead(leadId);
    if (!lead.demo) throw new WorkflowError("Only a demo lead can be saved as a recording.");
    if (lead.demo.mode !== "live") throw new WorkflowError("Recordings can only be made from a live AI demo.");
    if (!isStateAtLeast(lead.state, "dashboard_generated")) {
      throw new WorkflowError("Run the demo through the dashboard step first.");
    }

    const [q1, a1, q2, a2, versions, dashboard, email] = await Promise.all([
      getQuestions(leadId, 1),
      getAnswers(leadId, 1),
      getQuestions(leadId, 2),
      getAnswers(leadId, 2),
      listProposalVersions(leadId),
      getDashboard(leadId),
      getCoverEmail(leadId),
    ]);
    const withoutExtra = (qs: typeof q1) => qs.filter((q) => q.id !== EXTRA_INFO_QUESTION.id);
    const aiVersions = versions.filter((v) => v.source === "ai");
    const firstFeedback = aiVersions.find((v) => v.feedback)?.feedback;

    const files: Record<string, unknown> = {
      "questions1-1.json": { questions: withoutExtra(q1) },
      "answers-1.json": { answers: a1 },
      "questions2-1.json": { questions: withoutExtra(q2) },
      "answers-2.json": { answers: a2 },
      "dashboard-1.json": dashboard.spec,
      "meta.json": {
        sourceLeadId: leadId,
        recordedAt: new Date().toISOString(),
        model: llmModel(),
        promptVersions: PROMPT_VERSIONS,
      },
    };
    aiVersions.forEach((v, i) => {
      files[`proposal-${i + 1}.json`] = v.content;
    });
    if (firstFeedback) files["feedback-1.json"] = splitSectionFeedback(firstFeedback);
    if (email) files["coverEmail-1.json"] = email;

    await writeRecording(lead.demo.scenarioId, files);
    return NextResponse.json({ ok: true, scenarioId: lead.demo.scenarioId, files: Object.keys(files) });
  } catch (err) {
    return handleApiError(err);
  }
}
