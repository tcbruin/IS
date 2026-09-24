import { z } from "zod";
import type { LeadState } from "./validation";

/**
 * Evaluation telemetry: one JSON object per line in data/leads/<id>/events.jsonl. Events carry
 * metadata only — never transcript, prompt or AI output text — so the log itself holds no client
 * content. Server events are constructed in code (typed below); client events arrive over HTTP
 * and are therefore zod-validated.
 */

export const STEP_KEYS = ["gesprek", "voorstel", "dashboard", "versturen"] as const;
export const stepKeySchema = z.enum(STEP_KEYS);
export type StepKey = z.infer<typeof stepKeySchema>;

export type LLMStep = "questions1" | "proposal" | "questions2" | "dashboard" | "coverEmail" | "ping";

export const RATED_ARTIFACTS = ["questions", "proposal", "dashboard", "email"] as const;

export const FAILURE_CATEGORIES = [
  "Verzonnen feit",
  "Verkeerde scope",
  "Onjuiste inschatting",
  "Toon/stijl",
  "Onvolledig",
  "Technisch",
  "Anders",
] as const;

export const clientEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("active_time"), step: stepKeySchema, seconds: z.number().int().min(1).max(3600) }),
  z.object({ type: z.literal("rating"), artifact: z.enum(RATED_ARTIFACTS), score: z.number().int().min(1).max(5) }),
  z.object({ type: z.literal("retro_comment"), text: z.string().trim().min(1).max(2000) }),
  z.object({ type: z.literal("baseline_estimate"), minutes: z.number().int().min(1).max(10000) }),
  z.object({
    type: z.literal("failure_report"),
    step: stepKeySchema,
    category: z.enum(FAILURE_CATEGORIES),
    severity: z.enum(["klein", "groot"]),
    section: z.string().max(40).optional(),
    note: z.string().max(2000).optional(),
  }),
  z.object({ type: z.literal("email_copied") }),
  z.object({ type: z.literal("attachment_opened"), kind: z.enum(["proposalDocx", "proposalPdf", "dashboardPdf", "dashboardHtml"]) }),
]);
export type ClientEvent = z.infer<typeof clientEventSchema>;

export type ServerEvent =
  | {
      type: "lead_created";
      source: "upload" | "demo";
      transcriptChars: number;
      hasNotes: boolean;
      hasSourceSystem: boolean;
      intakeSeconds?: number;
    }
  | { type: "state_changed"; from: LeadState; to: LeadState }
  | {
      type: "llm_call";
      step: LLMStep;
      model: string;
      promptVersion: string;
      ok: boolean;
      attempts: number;
      durationMs: number;
      promptTokens: number;
      completionTokens: number;
      cacheHitTokens: number;
      replayed?: boolean;
      error?: string;
    }
  | { type: "questions_generated"; round: 1 | 2; count: number; avgChars: number; maxChars: number }
  | {
      type: "answers_submitted";
      round: 1 | 2;
      total: number;
      answered: number;
      estimated: number;
      blank: number;
      extraInfoFilled: boolean;
      isResubmit: boolean;
    }
  | {
      type: "proposal_version_created";
      version: number;
      source: "ai" | "manual";
      withFeedback: boolean;
      commentedSections: string[];
      warnings: number;
      changedPct?: number;
      changedPctVsAi?: number | null;
    }
  | { type: "proposal_finalized"; version: number; aiVersions: number; manualVersions: number }
  | { type: "proposal_reopened"; fromState: LeadState }
  | { type: "dashboard_generated"; regeneration: boolean; warnings: number }
  | { type: "cover_email_generated" }
  | { type: "marked_sent" };

export type TelemetryEventInput = ServerEvent | ClientEvent;
export type TelemetryEvent = TelemetryEventInput & { v: 1; at: string };
