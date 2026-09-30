import { z } from "zod";
import { slugify } from "./slugify";
import { dashboardSpecSchema } from "./dashboardSpec";
import type { Locale } from "./i18n";

export const LEAD_STATES = [
  "transcript_uploaded",
  "questions1_generated",
  "questions1_answered",
  "proposal_generated",
  "proposal_finalized",
  "questions2_generated",
  "questions2_answered",
  "dashboard_generated",
  "sent",
] as const;

export const leadStateSchema = z.enum(LEAD_STATES);
export type LeadState = z.infer<typeof leadStateSchema>;

export const leadSchema = z.object({
  id: z.string(),
  companyName: z.string().min(1),
  leadName: z.string().optional(),
  /** The system the client's data will actually be pulled from (e.g. "Exact Online",
   * "Twinfield", "Excel-sheets") — filled in at intake, never invented by the AI. Used as
   * context for the proposal/dashboard prompts. */
  sourceSystem: z.string().optional(),
  /** Set only on leads started from /demo. "replay" returns recorded AI answers instantly
   * (presentations); "live" calls the real API. Demo leads are excluded from evaluation stats
   * by default and never feed the proposal example library. */
  demo: z
    .object({ scenarioId: z.string(), mode: z.enum(["replay", "live"]) })
    .optional(),
  state: leadStateSchema,
  stateHistory: z.array(z.object({ state: leadStateSchema, at: z.string() })),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Lead = z.infer<typeof leadSchema>;

export const questionSchema = z.object({
  id: z.string(),
  text: z.string().min(1),
  /** Optional one-liner on *why* the question matters (never a suggested answer). Shown as
   * helper text, and passed back to later prompts so a short answer keeps its context. */
  hint: z.string().optional(),
});
export type Question = z.infer<typeof questionSchema>;

export const questionsResponseSchema = z.object({
  questions: z.array(questionSchema).min(1).max(8),
});
export type QuestionsResponse = z.infer<typeof questionsResponseSchema>;

export const answerSchema = z.object({
  questionId: z.string(),
  answer: z.string(),
});
export type Answer = z.infer<typeof answerSchema>;

/** Submitted as the `answer` value when the consultant checks "let the AI estimate this" for a
 * question they genuinely can't answer — the consultant only has the same transcript/notes the
 * AI already has, so they can steer direction and make assumptions, never supply facts nobody
 * has. This is a full, readable sentence (not an opaque code) deliberately: it's read
 * as-is both by the account owner (in the read-only Q&A view) and by the AI (via formatQA in
 * every downstream prompt) — no special-case branching needed anywhere that renders answers. */
export const AI_ESTIMATE_SENTINEL =
  "No concrete answer — estimate this yourself based on the transcript and the notes.";

/** The Dutch wording that answers saved before the English translation still contain. */
const LEGACY_AI_ESTIMATE_SENTINEL =
  "Geen concreet antwoord — schat dit zelf in op basis van het transcript en de notities.";

export function aiEstimateSentinel(locale: Locale): string {
  return locale === "nl" ? LEGACY_AI_ESTIMATE_SENTINEL : AI_ESTIMATE_SENTINEL;
}

export function isAiEstimateAnswer(answer: string): boolean {
  return answer === AI_ESTIMATE_SENTINEL || answer === LEGACY_AI_ESTIMATE_SENTINEL;
}

/** A fixed, non-AI-authored question appended to every generated question list (both rounds) —
 * a catch-all free-text field for context that doesn't fit any specific question. Reuses the
 * existing Question/Answer storage and every place that already renders/formats them, instead
 * of adding a parallel "extra notes" field and schema. */
export const EXTRA_INFO_QUESTION: Question = {
  id: "extra-info",
  text: "Anything else the AI should know? (optional)",
};

export function extraInfoQuestion(locale: Locale): Question {
  return locale === "nl"
    ? { id: EXTRA_INFO_QUESTION.id, text: "Moet de AI nog iets anders weten? (optioneel)" }
    : EXTRA_INFO_QUESTION;
}

/** AI-generated ids aren't trustworthy: slugify them, make them unique and keep the fixed
 * extra-info id reserved, so answers can always be matched to their question by id. */
export function normalizeQuestionIds(questions: Question[]): Question[] {
  const used = new Set<string>([EXTRA_INFO_QUESTION.id]);
  return questions.map((q, i) => {
    const base = slugify(q.id, `question-${i + 1}`);
    let id = base;
    for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
    used.add(id);
    return { ...q, id };
  });
}

export const answersSchema = z.object({
  answers: z.array(answerSchema).min(1),
});
export type AnswersPayload = z.infer<typeof answersSchema>;

export const proposalContentSchema = z.object({
  coverIntro: z.string().min(1),
  situation: z.string().min(1),
  goals: z.array(z.string().min(1)).min(1),
  approach: z.string().min(1),
  scopeDeliverables: z.array(z.string().min(1)).min(1),
  timeline: z.object({
    phases: z
      .array(
        z.object({
          name: z.string().min(1),
          description: z.string().min(1),
        }),
      )
      .min(1),
  }),
  investment: z.string().min(1),
  nextSteps: z.string().min(1),
});
export type ProposalContent = z.infer<typeof proposalContentSchema>;

export const coverEmailSchema = z.object({
  subject: z.string().min(1),
  body: z.string().min(1),
});
export type CoverEmail = z.infer<typeof coverEmailSchema>;

export const proposalVersionSchema = z.object({
  version: z.number().int().positive(),
  content: proposalContentSchema,
  basedOnVersion: z.number().int().positive().nullable(),
  feedback: z.string().nullable(),
  createdAt: z.string(),
  warnings: z.array(z.string()),
  /** Who wrote this version. Older files predate manual editing, so they parse as "ai". */
  source: z.enum(["ai", "manual"]).default("ai"),
  /** Manual versions only: how much the human changed (see lib/editMetrics.ts). */
  editStats: z
    .object({
      comparedToVersion: z.number().int().positive(),
      changedPct: z.number(),
      /** Change relative to the AI version this edit descends from — the evaluation metric. */
      aiVersion: z.number().int().positive().nullable(),
      changedPctVsAi: z.number().nullable(),
      sectionsChanged: z.array(z.string()),
    })
    .optional(),
});
export type ProposalVersion = z.infer<typeof proposalVersionSchema>;

export const proposalEditRequestSchema = z.object({
  content: proposalContentSchema,
  basedOnVersion: z.number().int().positive(),
  /** Save even though a newer version exists (user confirmed after a stale-version warning). */
  force: z.boolean().optional(),
});

export const proposalCurrentSchema = z.object({
  latestVersion: z.number().int().nonnegative(),
  finalVersion: z.number().int().positive().nullable(),
});
export type ProposalCurrent = z.infer<typeof proposalCurrentSchema>;

/**
 * A generated PoC dashboard: the AI-designed spec (see lib/dashboardSpec.ts) plus what's needed
 * to regenerate its illustrative data deterministically. Rows are never stored — the engine
 * rebuilds them from (spec, seed, generatedAt). Version 1 records (the old "relabel a fixed
 * sales dataset" format) are no longer rendered; see LegacyDashboardError.
 */
export const dashboardRecordSchema = z.object({
  version: z.literal(2),
  spec: dashboardSpecSchema,
  seed: z.string(),
  generatedAt: z.string(),
  warnings: z.array(z.string()).default([]),
});
export type DashboardRecord = z.infer<typeof dashboardRecordSchema>;
