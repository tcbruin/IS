import OpenAI from "openai";
import type { z } from "zod";
import {
  type Answer,
  type CoverEmail,
  type Lead,
  type ProposalContent,
  type Question,
  type QuestionsResponse,
  coverEmailSchema,
  proposalContentSchema,
  questionsResponseSchema,
} from "./validation";
import { dashboardSpecSchema, dryRunDashboard, normalizeSpec, type DashboardSpec } from "./dashboardSpec";
import { buildQuestions1Prompt, PROMPT_VERSION as QUESTIONS1_VERSION } from "./prompts/questions1";
import { buildProposalCompactionPrompt, buildProposalPrompt, PROMPT_VERSION as PROPOSAL_VERSION } from "./prompts/proposal";
import { buildQuestions2Prompt, PROMPT_VERSION as QUESTIONS2_VERSION } from "./prompts/questions2";
import { buildDashboardPrompt, PROMPT_VERSION as DASHBOARD_VERSION } from "./prompts/dashboard";
import { buildCoverEmailPrompt, PROMPT_VERSION as COVER_EMAIL_VERSION } from "./prompts/send";
import { applyDashboardGuardrails, applyProposalGuardrails } from "./guardrails";
import { logEvent, readEvents } from "./telemetry";
import { getRecording } from "./demo";
import { getSettings } from "./settings";
import type { LLMStep, ProposalWarningCategory } from "./telemetryEvents";
import type { ProposalExample } from "./exampleLibrary";
import type { Locale } from "./i18n";
import { compactProposalFallback, proposalCompactnessIssues } from "./proposalCompactness";

export class LLMError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LLMError";
  }
}

/** Which lead an AI call belongs to — every generator takes this as its last argument so each
 * call is logged against its lead (and, for demo leads, can be replayed). */
export type LLMContext = { leadId: string; demo?: Lead["demo"] };

export function llmContext(lead: Lead): LLMContext {
  return { leadId: lead.id, demo: lead.demo };
}

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    // LLM_API_KEY is the generic name; DEEPSEEK_API_KEY is kept as a fallback so existing
    // .env.local files keep working. A local runtime (e.g. Ollama) ignores the key's value —
    // any non-empty placeholder works — but the OpenAI SDK still requires one to be set.
    const apiKey = process.env.LLM_API_KEY ?? process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new LLMError(
        "LLM_API_KEY (or DEEPSEEK_API_KEY) is missing. Set it in .env.local (see .env.example).",
      );
    }
    client = new OpenAI({
      apiKey,
      baseURL: process.env.LLM_BASE_URL ?? "https://api.deepseek.com",
    });
  }
  return client;
}

export function llmModel(): string {
  return process.env.LLM_MODEL ?? "deepseek-chat";
}

/** DeepSeek reports prompt-cache hits in a non-standard usage field the OpenAI SDK doesn't type. */
type UsageWithCache = OpenAI.CompletionUsage & { prompt_cache_hit_tokens?: number };

/** Current prompt version per AI step — shown on /demo to flag recordings made with older prompts. */
export const PROMPT_VERSIONS: Record<string, string> = {
  questions1: QUESTIONS1_VERSION,
  proposal: PROPOSAL_VERSION,
  questions2: QUESTIONS2_VERSION,
  dashboard: DASHBOARD_VERSION,
  coverEmail: COVER_EMAIL_VERSION,
};

/**
 * Demo replay mode: return the recorded output for the n-th call of this step on this lead,
 * after a short artificial delay, instead of calling the API. Returns undefined when there is
 * no usable recording — the caller then calls the API live, so a demo never gets stuck.
 */
async function replayRecording<T>(opts: {
  ctx: LLMContext;
  step: LLMStep;
  promptVersion: string;
  schema: z.ZodType<T, z.ZodTypeDef, unknown>;
}): Promise<T | undefined> {
  const demo = opts.ctx.demo;
  if (!demo || demo.mode !== "replay") return undefined;
  const previous = (await readEvents(opts.ctx.leadId)).filter((e) => e.type === "llm_call" && e.step === opts.step).length;
  const recorded = await getRecording(demo.scenarioId, opts.step, previous + 1);
  const parsed = recorded === null ? null : opts.schema.safeParse(recorded);
  if (!parsed?.success) return undefined;
  const started = performance.now();
  const { replayDelayMs } = await getSettings();
  await new Promise((resolve) => setTimeout(resolve, replayDelayMs));
  await logEvent(opts.ctx.leadId, {
    type: "llm_call",
    step: opts.step,
    model: "recording",
    promptVersion: opts.promptVersion,
    ok: true,
    attempts: 1,
    durationMs: Math.round(performance.now() - started),
    promptTokens: 0,
    completionTokens: 0,
    cacheHitTokens: 0,
    replayed: true,
  });
  return parsed.data;
}

/** Tiny live call for the demo pre-flight check: is the API reachable, and how fast? */
export async function pingLLM(): Promise<{ ok: boolean; ms: number; model: string; error?: string }> {
  const model = llmModel();
  const started = performance.now();
  try {
    await getClient().chat.completions.create({
      model,
      messages: [{ role: "user", content: "Reply with: ok" }],
      max_tokens: 3,
    });
    return { ok: true, ms: Math.round(performance.now() - started), model };
  } catch (err) {
    return { ok: false, ms: Math.round(performance.now() - started), model, error: (err as Error).message?.slice(0, 160) };
  }
}

async function callLLM<T>(opts: {
  ctx: LLMContext;
  step: LLMStep;
  promptVersion: string;
  system: string;
  user: string;
  schema: z.ZodType<T, z.ZodTypeDef, unknown>;
  temperature?: number;
  maxAttempts?: number;
}): Promise<T> {
  const replayed = await replayRecording(opts);
  if (replayed !== undefined) return replayed;

  const model = llmModel();
  const maxAttempts = opts.maxAttempts ?? 2;
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: opts.system },
    { role: "user", content: opts.user },
  ];
  const started = performance.now();
  const usage = { promptTokens: 0, completionTokens: 0, cacheHitTokens: 0 };
  let attempts = 0;
  let ok = false;
  let error: string | undefined;

  try {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      attempts++;
      let completion: OpenAI.Chat.ChatCompletion;
      try {
        completion = await getClient().chat.completions.create({
          model,
          messages,
          response_format: { type: "json_object" },
          temperature: opts.temperature ?? 0.4,
          // Ollama-specific extensions, ignored by providers that don't recognize them (e.g. DeepSeek):
          // - think: disables reasoning models' (e.g. Qwen3) "thinking" mode, which otherwise burns
          //   thousands of tokens of chain-of-thought before answering.
          // - options.num_ctx: Ollama's default context window (2048 tokens) is smaller than our
          //   prompts, which silently truncates the prompt instead of erroring.
          think: false,
          options: { num_ctx: 8192 },
        } as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming & {
          think: false;
          options: { num_ctx: number };
        });
      } catch (err) {
        if (err instanceof LLMError) throw err;
        error = (err as Error).message?.slice(0, 200) ?? "unknown error";
        throw new LLMError("The AI service is unreachable or returned an error. Please try again.");
      }

      const u = completion.usage as UsageWithCache | undefined;
      usage.promptTokens += u?.prompt_tokens ?? 0;
      usage.completionTokens += u?.completion_tokens ?? 0;
      usage.cacheHitTokens += u?.prompt_cache_hit_tokens ?? 0;

      const raw = completion.choices[0]?.message?.content ?? "";
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        messages.push({ role: "assistant", content: raw });
        messages.push({
          role: "user",
          content: "That was not valid JSON. Respond again with a single valid JSON object only.",
        });
        continue;
      }

      const result = opts.schema.safeParse(parsed);
      if (result.success) {
        ok = true;
        return result.data;
      }

      messages.push({ role: "assistant", content: raw });
      messages.push({
        role: "user",
        content: `That JSON did not match the required shape. Validation errors:\n${JSON.stringify(
          result.error.issues,
          null,
          2,
        )}\nRespond again with a single corrected JSON object only.`,
      });
    }

    error = "Invalid response after all attempts";
    throw new LLMError("The AI response could not be processed, even after a retry. Please try again.");
  } finally {
    await logEvent(opts.ctx.leadId, {
      type: "llm_call",
      step: opts.step,
      model,
      promptVersion: opts.promptVersion,
      ok,
      attempts,
      durationMs: Math.round(performance.now() - started),
      ...usage,
      ...(error && !ok ? { error } : {}),
    });
  }
}

export async function generateClarifyingQuestions(
  input: { transcript: string; notes?: string; sourceSystem?: string; locale?: Locale },
  ctx: LLMContext,
): Promise<Question[]> {
  const { system, user } = buildQuestions1Prompt(input.transcript, input.notes, input.sourceSystem, input.locale);
  const result = await callLLM<QuestionsResponse>({
    ctx,
    step: "questions1",
    promptVersion: QUESTIONS1_VERSION,
    system,
    user,
    schema: questionsResponseSchema,
  });
  return result.questions;
}

export async function generateProposal(
  input: {
    transcript: string;
    notes?: string;
    sourceSystem?: string;
    questions: Question[];
    answers: Answer[];
    priorDraft?: ProposalContent;
    feedback?: string;
    examples?: ProposalExample[];
    locale?: Locale;
  },
  ctx: LLMContext,
): Promise<{ content: ProposalContent; warnings: string[]; warningCategories: ProposalWarningCategory[] }> {
  const { system, user } = buildProposalPrompt(input);
  let raw = await callLLM<ProposalContent>({
    ctx,
    step: "proposal",
    promptVersion: PROPOSAL_VERSION,
    system,
    user,
    schema: proposalContentSchema,
  });
  let issues = proposalCompactnessIssues(raw);
  // Models count words approximately. Feed the measured violations back on each
  // bounded retry instead of failing after a single near-miss.
  for (let attempt = 0; issues.length && attempt < 3; attempt++) {
    const compact = buildProposalCompactionPrompt(raw, issues, input.locale);
    try {
      raw = await callLLM<ProposalContent>({
      ctx,
      step: "proposal",
      promptVersion: PROPOSAL_VERSION,
      system: compact.system,
      user: compact.user,
      schema: proposalContentSchema,
      });
    } catch (err) {
      // An initial valid draft already exists. A failed optional shortening
      // call must not prevent the consultant from receiving it.
      if (!(err instanceof LLMError)) throw err;
      break;
    }
    issues = proposalCompactnessIssues(raw);
  }
  const usedFallback = issues.length > 0;
  const result = applyProposalGuardrails(usedFallback ? compactProposalFallback(raw) : raw);
  if (usedFallback) result.warningCategories.push("length");
  if (usedFallback) result.warnings.push(input.locale === "nl"
    ? "Dit concept bevat meer tekst dan het aanbevolen budget. De preview en PDF passen de tekstgrootte aan voor één pagina. Controleer de leesbaarheid voordat je het deelt."
    : "This draft exceeds the recommended text budget. The preview and PDF adjust text size to fit one page. Check readability before sharing.");
  return result;
}

export async function generateDashboardQuestions(
  input: {
    transcript: string;
    notes?: string;
    sourceSystem?: string;
    proposal: ProposalContent;
    locale?: Locale;
  },
  ctx: LLMContext,
): Promise<Question[]> {
  const { system, user } = buildQuestions2Prompt(input);
  const result = await callLLM<QuestionsResponse>({
    ctx,
    step: "questions2",
    promptVersion: QUESTIONS2_VERSION,
    system,
    user,
    schema: questionsResponseSchema,
  });
  return result.questions;
}

/** The AI designs the spec; guardrails check its anchors against the sources; the spec is
 * clamped to the layout and built once (dry run) before it is accepted. */
export async function generateDashboard(
  input: {
    transcript: string;
    notes?: string;
    sourceSystem?: string;
    proposal: ProposalContent;
    questions: Question[];
    answers: Answer[];
    locale?: Locale;
  },
  ctx: LLMContext,
  build: { seed: string; generatedAt: string },
): Promise<{ spec: DashboardSpec; warnings: string[] }> {
  const { system, user } = buildDashboardPrompt(input);
  const raw = await callLLM<DashboardSpec>({
    ctx,
    step: "dashboard",
    promptVersion: DASHBOARD_VERSION,
    system,
    user,
    schema: dashboardSpecSchema,
    temperature: 0.3,
    maxAttempts: 3,
  });
  const guarded = applyDashboardGuardrails(raw, {
    transcript: input.transcript,
    notes: input.notes,
    answers: input.answers,
  });
  const normalized = normalizeSpec(guarded.spec);
  let built: { spec: DashboardSpec; warnings: string[] };
  try {
    built = dryRunDashboard(normalized.spec, build.seed, build.generatedAt);
  } catch {
    throw new LLMError("The dashboard could not be built from the AI's design. Please try again.");
  }
  return { spec: built.spec, warnings: [...guarded.warnings, ...normalized.warnings, ...built.warnings] };
}

export async function generateCoverEmail(
  input: {
    companyName: string;
    leadName?: string;
    proposalIntro: string;
    proposalNextSteps: string;
    dashboardTitle: string;
    locale?: Locale;
  },
  ctx: LLMContext,
): Promise<CoverEmail> {
  const { system, user } = buildCoverEmailPrompt(input);
  return callLLM<CoverEmail>({
    ctx,
    step: "coverEmail",
    promptVersion: COVER_EMAIL_VERSION,
    system,
    user,
    schema: coverEmailSchema,
  });
}
