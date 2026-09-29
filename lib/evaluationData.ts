import { listLeads } from "./leadStore";
import { getSettings } from "./settings";
import { readEvents } from "./telemetry";
import { leadMetrics, stepMetrics, summarize } from "./evaluation";

/**
 * Loads everything /evaluation and the CSV export need. Counted: leads created since the
 * measurement started (they have a lead_created event — older leads miss half their history).
 * Replayed demo leads never count (their AI timings are fake); live demo leads only on request.
 */
export async function loadEvaluation({ includeDemo }: { includeDemo: boolean }) {
  const [leads, settings] = await Promise.all([listLeads(), getSettings()]);
  const candidates = leads.filter((l) => !l.demo || (includeDemo && l.demo.mode === "live"));
  const rows = (await Promise.all(candidates.map(async (lead) => ({ lead, events: await readEvents(lead.id) })))).filter(
    (r) => r.events.some((e) => e.type === "lead_created"),
  );
  const metrics = rows.map((r) => leadMetrics(r.lead, r.events, settings));
  const allEvents = rows.flatMap((r) => r.events);
  return {
    settings,
    rows,
    metrics,
    summary: summarize(metrics, allEvents, settings),
    steps: stepMetrics(allEvents, settings),
  };
}
