import { promises as fs } from "fs";
import path from "path";
import { z } from "zod";
import { answerSchema, type Answer } from "./validation";
import type { LLMStep } from "./telemetryEvents";

/**
 * Demo mode for presentations. Scenarios (demo/scenarios.json) are ready-made leads with a
 * transcript and notes. A completed live run of a scenario can be saved as a recording
 * (demo/recordings/<scenario>/); a "replay" demo lead then gets those AI answers back instantly
 * instead of calling the API, so a live presentation never depends on API speed or wifi.
 */

const DEMO_DIR = path.join(process.cwd(), "demo");
const RECORDINGS_DIR = path.join(DEMO_DIR, "recordings");

const scenarioSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  companyName: z.string(),
  leadName: z.string().optional(),
  sourceSystem: z.string().optional(),
  pitch: z.string(),
  transcriptFile: z.string(),
  notesFile: z.string().optional(),
  /** What the account owner "knows" — used to fill the extra-info question in a live demo. */
  briefing: z.string(),
});
export type Scenario = z.infer<typeof scenarioSchema>;

/** The AI steps a recording covers, in flow order. */
export const RECORDED_STEPS: LLMStep[] = ["questions1", "proposal", "questions2", "dashboard", "coverEmail"];

export async function listScenarios(): Promise<Scenario[]> {
  const raw = JSON.parse(await fs.readFile(path.join(DEMO_DIR, "scenarios.json"), "utf-8"));
  return z.object({ scenarios: z.array(scenarioSchema) }).parse(raw).scenarios;
}

export async function getScenario(id: string): Promise<Scenario | null> {
  return (await listScenarios()).find((s) => s.id === id) ?? null;
}

export async function readScenarioFile(file: string): Promise<string> {
  return fs.readFile(path.join(DEMO_DIR, file), "utf-8");
}

/** Scenario ids come from scenarios.json only, so they are safe as folder names. */
async function recordingDir(scenarioId: string): Promise<string> {
  if (!(await getScenario(scenarioId))) throw new Error(`Unknown demo scenario: ${scenarioId}`);
  return path.join(RECORDINGS_DIR, scenarioId);
}

async function readRecordingFile(scenarioId: string, name: string): Promise<unknown | null> {
  try {
    return JSON.parse(await fs.readFile(path.join(await recordingDir(scenarioId), name), "utf-8"));
  } catch {
    return null;
  }
}

/** The recorded AI output for the n-th call of a step (1-based), or null. */
export function getRecording(scenarioId: string, step: LLMStep, n: number): Promise<unknown | null> {
  return readRecordingFile(scenarioId, `${step}-${n}.json`);
}

export async function getDemoAnswers(scenarioId: string, round: 1 | 2): Promise<Answer[] | null> {
  const data = await readRecordingFile(scenarioId, `answers-${round}.json`);
  const parsed = z.object({ answers: z.array(answerSchema) }).safeParse(data);
  return parsed.success ? parsed.data.answers : null;
}

export async function getDemoFeedback(scenarioId: string): Promise<Record<string, string> | null> {
  const parsed = z.record(z.string()).safeParse(await readRecordingFile(scenarioId, "feedback-1.json"));
  return parsed.success && Object.keys(parsed.data).length ? parsed.data : null;
}

export const recordingMetaSchema = z.object({
  sourceLeadId: z.string(),
  recordedAt: z.string(),
  model: z.string(),
  promptVersions: z.record(z.string()),
});

export async function getRecordingStatus(scenarioId: string) {
  const steps = Object.fromEntries(
    await Promise.all(RECORDED_STEPS.map(async (s) => [s, (await getRecording(scenarioId, s, 1)) !== null] as const)),
  ) as Record<LLMStep, boolean>;
  const meta = recordingMetaSchema.safeParse(await readRecordingFile(scenarioId, "meta.json"));
  return {
    steps,
    complete: RECORDED_STEPS.every((s) => steps[s]),
    meta: meta.success ? meta.data : null,
  };
}

/** Replaces a scenario's recording with the given files (name → JSON content). */
export async function writeRecording(scenarioId: string, files: Record<string, unknown>): Promise<void> {
  const dir = await recordingDir(scenarioId);
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });
  for (const [name, data] of Object.entries(files)) {
    await fs.writeFile(path.join(dir, name), JSON.stringify(data, null, 2), "utf-8");
  }
}
