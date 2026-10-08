import { listLeads } from "./leadStore";
import { getSettings } from "./settings";
import { readEvents } from "./telemetry";
import { leadMetrics, stepMetrics, summarize } from "./evaluation";
import { evaluationDemoRows, EVALUATION_DEMO_SETTINGS } from "./evaluationDemo";
import type { Lead } from "./validation";
import type { TelemetryEvent } from "./telemetryEvents";
import type { Settings } from "./settings";

export type EvaluationMode = "demo" | "actual";
export type EvaluationRow = { lead: Lead; events: TelemetryEvent[] };

export function buildEvaluation(rows: EvaluationRow[], settings: Settings, mode: EvaluationMode) {
  const metrics = rows.map((r) => leadMetrics(r.lead, r.events, settings));
  const allEvents = rows.flatMap((r) => r.events);
  return { mode, provenance: mode === "demo" ? "illustrative" as const : "measured" as const,
    settings, rows, metrics, summary: summarize(metrics, allEvents, settings), steps: stepMetrics(allEvents, settings) };
}

export function selectEvaluation(actualRows: EvaluationRow[], settings: Settings, mode?: EvaluationMode) {
  const selected = mode ?? (actualRows.length ? "actual" : "demo");
  return selected === "demo"
    ? buildEvaluation(evaluationDemoRows(), EVALUATION_DEMO_SETTINGS, "demo")
    : buildEvaluation(actualRows, settings, "actual");
}

/**
 * Loads everything /evaluation and the CSV export need. Counted: leads created since the
 * measurement started (they have a lead_created event — older leads miss half their history).
 * Replayed demo leads never count (their AI timings are fake); live demo leads only on request.
 */
export async function loadEvaluation({ includeDemo = false, mode }: { includeDemo?: boolean; mode?: EvaluationMode } = {}) {
  if (mode === "demo") return selectEvaluation([], EVALUATION_DEMO_SETTINGS, "demo");
  const [leads, settings] = await Promise.all([listLeads(), getSettings()]);
  const candidates = leads.filter((l) => !l.demo || (includeDemo && l.demo.mode === "live"));
  const rows = (await Promise.all(candidates.map(async (lead) => ({ lead, events: await readEvents(lead.id) })))).filter(
    (r) => r.events.some((e) => e.type === "lead_created"),
  );
  return selectEvaluation(rows, settings, mode ?? (includeDemo ? "actual" : undefined));
}
