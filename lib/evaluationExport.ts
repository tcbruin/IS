import type { buildEvaluation } from "./evaluationData";
import { llmCostUsd, PRICING_SOURCE_URL, PRICING_VERIFIED_ON } from "./llmPricing";
import { STATE_LABELS } from "./workflow";

export function evaluationExportRecords(data: ReturnType<typeof buildEvaluation>, type: "leads" | "events"): Record<string, unknown>[] {
  const { rows, metrics, settings, provenance, mode } = data;
  const meta = { mode, provenance, pricing_verified_on: PRICING_VERIFIED_ON,
    pricing_status: PRICING_VERIFIED_ON ? "verified" : "estimate", pricing_source: PRICING_SOURCE_URL,
    hourly_rate_eur: settings.hourlyRateEur, usd_to_eur: settings.usdToEur, baseline_source: settings.baselineSource };
  if (type === "events") return rows.flatMap(({ lead, events }) => events.map((event) => {
    const { v: _v, at, type: eventType, ...rest } = event;
    const extra: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rest)) extra[key] = Array.isArray(value) ? value.join(",") : value;
    if (event.type === "llm_call") {
      const usd = llmCostUsd(event);
      extra.cost_eur = usd === null ? null : usd * settings.usdToEur;
      extra.pricing_complete = usd !== null;
    }
    return { ...meta, lead_id: lead.id, company: lead.companyName, timestamp: at, type: eventType, ...extra };
  }));
  return metrics.map((m) => ({
    ...meta, lead_id: m.leadId, company: m.company,
    status: STATE_LABELS[rows.find((r) => r.lead.id === m.leadId)!.lead.state],
    demo: m.demo ? "yes" : "no", sent: m.sent ? "yes" : "no", comparison_provisional: !m.sent,
    started_at: m.firstAt, active_minutes: m.activeMinutes, throughput_minutes: m.throughputMinutes,
    ai_wait_minutes: m.aiWaitMinutes, baseline_minutes: settings.baselineMinutesPerLead,
    own_estimate_manual_minutes: m.baselineEstimate, ai_calls: m.aiCalls,
    ai_cost_eur: m.aiCostEur, known_ai_cost_subtotal_eur: m.knownAiCostEur, pricing_complete: m.aiCostKnown,
    consultant_cost_eur: m.consultantCostEur, manual_baseline_cost_eur: m.baselineCostEur,
    total_cost_eur: m.totalCostEur, savings_eur: m.savingsEur, savings_pct: m.savingsPct,
    feedback_rounds: m.feedbackRounds, manual_versions: m.manualVersions, manual_edit_pct: m.manualEditPct,
    questions_answered: m.answered, questions_estimated: m.estimated, questions_blank: m.blank,
    questions_prompt_version: m.q1PromptVersion,
    score_questions: m.ratings.questions, score_proposal: m.ratings.proposal,
    score_dashboard: m.ratings.dashboard, score_email: m.ratings.email,
    failures_manual: m.failures.filter((f) => f.source === "manual").length,
    failures_automatic: m.failures.filter((f) => f.source === "automatic").length,
  }));
}
