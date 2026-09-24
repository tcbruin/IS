import { promises as fs } from "fs";
import path from "path";
import { leadDir } from "./paths";
import { AI_ESTIMATE_SENTINEL, EXTRA_INFO_QUESTION, type Answer, type Question } from "./validation";
import type { TelemetryEvent, TelemetryEventInput } from "./telemetryEvents";

function eventsFile(leadId: string): string {
  return path.join(leadDir(leadId), "events.jsonl");
}

/** Appends one event to the lead's log. Never throws: telemetry must not break the actual flow.
 * appendFile doesn't create directories, so events for a deleted lead are silently dropped. */
export async function logEvent(leadId: string, event: TelemetryEventInput): Promise<void> {
  const line: TelemetryEvent = { v: 1, at: new Date().toISOString(), ...event };
  try {
    await fs.appendFile(eventsFile(leadId), `${JSON.stringify(line)}\n`, "utf-8");
  } catch (err) {
    console.warn(`Telemetry: kon event niet opslaan voor ${leadId}:`, (err as Error).message);
  }
}

export async function readEvents(leadId: string): Promise<TelemetryEvent[]> {
  let raw: string;
  try {
    raw = await fs.readFile(eventsFile(leadId), "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  const events: TelemetryEvent[] = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      events.push(JSON.parse(line) as TelemetryEvent);
    } catch {
      // A torn line (e.g. crash mid-write) shouldn't hide the rest of the log.
    }
  }
  return events;
}

export function questionStats(questions: Question[]) {
  const generated = questions.filter((q) => q.id !== EXTRA_INFO_QUESTION.id);
  const lengths = generated.map((q) => q.text.length);
  return {
    count: generated.length,
    avgChars: lengths.length ? Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length) : 0,
    maxChars: lengths.length ? Math.max(...lengths) : 0,
  };
}

export function answerStats(answers: Answer[]) {
  const regular = answers.filter((a) => a.questionId !== EXTRA_INFO_QUESTION.id);
  const extra = answers.find((a) => a.questionId === EXTRA_INFO_QUESTION.id);
  const estimated = regular.filter((a) => a.answer === AI_ESTIMATE_SENTINEL).length;
  const blank = regular.filter((a) => !a.answer.trim()).length;
  return {
    total: regular.length,
    answered: regular.length - estimated - blank,
    estimated,
    blank,
    extraInfoFilled: Boolean(extra?.answer.trim()),
  };
}
