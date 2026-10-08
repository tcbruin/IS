import type { Lead } from "./validation";
import type { Settings } from "./settings";
import type { TelemetryEvent } from "./telemetryEvents";
import { llmCostUsd } from "./llmPricing";

/**
 * Pure calculations behind /evaluation and its CSV export: per-lead metrics from the event log,
 * and aggregates across leads compared with the manual baseline. No I/O here, so the page and
 * the export can never compute different numbers.
 */

type Ev<T extends TelemetryEvent["type"]> = Extract<TelemetryEvent, { type: T }>;

function ofType<T extends TelemetryEvent["type"]>(events: TelemetryEvent[], type: T): Ev<T>[] {
  return events.filter((e): e is Ev<T> => e.type === type);
}

function last<T>(list: T[]): T | undefined {
  return list[list.length - 1];
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)];
}

function mean(values: number[]): number | null {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

export type FailureEntry = {
  leadId: string;
  company: string;
  at: string;
  source: "manual" | "automatic";
  step: string;
  category: string;
  severity: string;
  note: string;
};

export type LeadMetrics = {
  leadId: string;
  company: string;
  demo: boolean;
  sent: boolean;
  firstAt: string;
  activeMinutes: number;
  throughputMinutes: number;
  aiWaitMinutes: number;
  aiCalls: number;
  aiCostEur: number | null;
  knownAiCostEur: number;
  aiCostKnown: boolean;
  consultantCostEur: number;
  baselineCostEur: number;
  totalCostEur: number | null;
  savingsEur: number | null;
  savingsPct: number | null;
  feedbackRounds: number;
  manualVersions: number;
  manualEditPct: number | null;
  answered: number;
  estimated: number;
  blank: number;
  q1PromptVersion: string | null;
  q1AvgChars: number | null;
  ratings: Record<string, number>;
  baselineEstimate: number | null;
  failures: FailureEntry[];
};

export function leadMetrics(lead: Lead, events: TelemetryEvent[], settings: Settings): LeadMetrics {
  const llm = ofType(events, "llm_call");
  const costs = llm.map((c) => llmCostUsd(c));
  const active = ofType(events, "active_time").reduce((a, e) => a + e.seconds, 0);
  const intake = ofType(events, "lead_created")[0]?.intakeSeconds ?? 0;
  const sentAt = last(ofType(events, "marked_sent"))?.at;
  const firstAt = events[0]?.at ?? lead.createdAt;
  const endAt = sentAt ?? last(events)?.at ?? firstAt;
  const versions = ofType(events, "proposal_version_created");
  const manual = versions.filter((v) => v.source === "manual");
  const answers = [1, 2].map((round) => last(ofType(events, "answers_submitted").filter((a) => a.round === round)));
  const ratings: Record<string, number> = {};
  for (const r of ofType(events, "rating")) ratings[r.artifact] = r.score;
  const q1Call = last(llm.filter((c) => c.step === "questions1" && c.ok));
  const q1Stats = last(ofType(events, "questions_generated").filter((q) => q.round === 1));

  const failures: FailureEntry[] = [];
  const base = { leadId: lead.id, company: lead.companyName };
  for (const f of ofType(events, "failure_report")) {
    failures.push({ ...base, at: f.at, source: "manual", step: f.step, category: f.category, severity: f.severity, note: f.note ?? "" });
  }
  for (const c of llm) {
    if (!c.ok) failures.push({ ...base, at: c.at, source: "automatic", step: c.step, category: "AI call failed", severity: "major", note: c.error ?? "" });
    else if (c.attempts > 1) failures.push({ ...base, at: c.at, source: "automatic", step: c.step, category: "Invalid AI response, retried", severity: "minor", note: `${c.attempts} attempts` });
  }
  for (const v of versions) {
    if (v.source === "ai" && v.warnings > 0) {
      const categories = v.warningCategories?.length ? [...new Set(v.warningCategories)] : ["general"];
      for (const category of categories) failures.push({ ...base, at: v.at, source: "automatic", step: "proposal",
        category: category === "pricing" ? "Guardrail: amount in investment" : category === "length" ? "Proposal length/readability" : "Proposal warning",
        severity: "minor", note: `v${v.version}` });
    }
  }
  for (const d of ofType(events, "dashboard_generated")) {
    if (d.warnings > 0) failures.push({ ...base, at: d.at, source: "automatic", step: "dashboard", category: "Guardrail: figure from the call not used", severity: "minor", note: `${d.warnings} note(s)` });
  }

  const aiCostKnown = costs.every((c) => c !== null);
  const knownAiCostEur = costs.reduce<number>((a, c) => a + (c ?? 0), 0) * settings.usdToEur;
  const aiCostEur = aiCostKnown ? knownAiCostEur : null;
  const consultantCostEur = (active + intake) / 3600 * settings.hourlyRateEur;
  const baselineCostEur = settings.baselineMinutesPerLead / 60 * settings.hourlyRateEur;
  const totalCostEur = aiCostEur === null ? null : consultantCostEur + aiCostEur;
  const savingsEur = totalCostEur === null ? null : baselineCostEur - totalCostEur;
  return {
    leadId: lead.id,
    company: lead.companyName,
    demo: Boolean(lead.demo),
    sent: Boolean(sentAt),
    firstAt,
    activeMinutes: (active + intake) / 60,
    throughputMinutes: (new Date(endAt).getTime() - new Date(firstAt).getTime()) / 60000,
    aiWaitMinutes: llm.reduce((a, c) => a + c.durationMs, 0) / 60000,
    aiCalls: llm.length,
    aiCostEur, knownAiCostEur, aiCostKnown, consultantCostEur, baselineCostEur, totalCostEur, savingsEur,
    savingsPct: savingsEur === null ? null : 100 * savingsEur / baselineCostEur,
    feedbackRounds: versions.filter((v) => v.source === "ai" && v.withFeedback).length,
    manualVersions: manual.length,
    manualEditPct: last(manual.filter((m) => m.changedPctVsAi != null))?.changedPctVsAi ?? null,
    answered: answers.reduce((a, s) => a + (s?.answered ?? 0), 0),
    estimated: answers.reduce((a, s) => a + (s?.estimated ?? 0), 0),
    blank: answers.reduce((a, s) => a + (s?.blank ?? 0), 0),
    q1PromptVersion: q1Call?.promptVersion ?? null,
    q1AvgChars: q1Stats?.avgChars ?? null,
    ratings,
    baselineEstimate: last(ofType(events, "baseline_estimate"))?.minutes ?? null,
    failures,
  };
}

export type StepMetrics = {
  step: string;
  calls: number;
  medianSeconds: number | null;
  p90Seconds: number | null;
  avgPromptTokens: number | null;
  avgCompletionTokens: number | null;
  costEur: number | null;
  knownCostEur: number;
  pricingComplete: boolean;
  retries: number;
  failures: number;
};

export function stepMetrics(allEvents: TelemetryEvent[], settings: Settings): StepMetrics[] {
  const calls = ofType(allEvents, "llm_call");
  const steps = [...new Set(calls.map((c) => c.step))];
  return steps.map((step) => {
    const list = calls.filter((c) => c.step === step);
    const durations = list.map((c) => c.durationMs / 1000);
    const costs = list.map(llmCostUsd);
    const knownCostEur = costs.reduce<number>((a, c) => a + (c ?? 0), 0) * settings.usdToEur;
    return {
      step,
      calls: list.length,
      medianSeconds: median(durations),
      p90Seconds: percentile(durations, 90),
      avgPromptTokens: mean(list.map((c) => c.promptTokens)),
      avgCompletionTokens: mean(list.map((c) => c.completionTokens)),
      costEur: costs.every((c) => c !== null) ? knownCostEur : null,
      knownCostEur,
      pricingComplete: costs.every((c) => c !== null),
      retries: list.filter((c) => c.attempts > 1).length,
      failures: list.filter((c) => !c.ok).length,
    };
  });
}

export function summarize(leads: LeadMetrics[], allEvents: TelemetryEvent[], settings: Settings) {
  const completed = leads.filter((l) => l.sent);
  const timeBase = completed.length ? completed : leads;
  const medianActive = median(timeBase.map((l) => l.activeMinutes));
  const calls = ofType(allEvents, "llm_call");
  const firstTry = calls.filter((c) => c.ok && c.attempts === 1).length;
  const answeredTotal = leads.reduce((a, l) => a + l.answered + l.estimated + l.blank, 0);

  const ratingKeys = ["questions", "proposal", "dashboard", "email"];
  const ratings = Object.fromEntries(
    ratingKeys.map((k) => {
      const scores = leads.map((l) => l.ratings[k]).filter((s): s is number => typeof s === "number");
      return [k, { mean: mean(scores), n: scores.length }];
    }),
  );

  const byVersion = new Map<string, { answered: number; estimated: number; blank: number; leads: number; avgChars: number[] }>();
  for (const l of leads) {
    const key = l.q1PromptVersion ?? "unknown";
    const entry = byVersion.get(key) ?? { answered: 0, estimated: 0, blank: 0, leads: 0, avgChars: [] };
    entry.answered += l.answered;
    entry.estimated += l.estimated;
    entry.blank += l.blank;
    entry.leads += 1;
    if (l.q1AvgChars !== null) entry.avgChars.push(l.q1AvgChars);
    byVersion.set(key, entry);
  }

  const failures = leads.flatMap((l) => l.failures).sort((a, b) => b.at.localeCompare(a.at));
  const failuresByCategory = new Map<string, number>();
  for (const f of failures) failuresByCategory.set(f.category, (failuresByCategory.get(f.category) ?? 0) + 1);

  const pricingComplete = leads.every((l) => l.aiCostKnown);
  const cohortPricingComplete = timeBase.every((l) => l.aiCostKnown);
  const aiCostPerLead = cohortPricingComplete ? median(timeBase.map((l) => l.aiCostEur!)) : null;
  const baselineCost = (settings.baselineMinutesPerLead / 60) * settings.hourlyRateEur;
  const humanCost = medianActive !== null ? (medianActive / 60) * settings.hourlyRateEur : null;
  const costPerLeadWithApp = cohortPricingComplete ? median(timeBase.map((l) => l.totalCostEur!)) : null;
  const savingsEur = costPerLeadWithApp === null ? null : baselineCost - costPerLeadWithApp;

  return {
    leadCount: leads.length,
    completedCount: completed.length,
    provisional: completed.length === 0,
    pricingComplete,
    cohortPricingComplete,
    timeBasis: completed.length ? "completed leads" : "all leads (none completed yet)",
    medianActiveMinutes: medianActive,
    medianThroughputMinutes: median(timeBase.map((l) => l.throughputMinutes)),
    medianAiWaitMinutes: median(timeBase.map((l) => l.aiWaitMinutes)),
    baselineMinutes: settings.baselineMinutesPerLead,
    timeSavedPct: medianActive !== null ? 100 * (1 - medianActive / settings.baselineMinutesPerLead) : null,
    medianOwnEstimate: median(leads.map((l) => l.baselineEstimate).filter((m): m is number => m !== null)),
    aiCostPerLead,
    aiCostTotal: pricingComplete ? leads.reduce((a, l) => a + l.knownAiCostEur, 0) : null,
    knownAiCostTotal: leads.reduce((a, l) => a + l.knownAiCostEur, 0),
    humanCostPerLead: humanCost,
    baselineCostPerLead: baselineCost,
    costPerLeadWithApp,
    savingsEur,
    savingsPct: savingsEur === null ? null : 100 * savingsEur / baselineCost,
    ratings,
    answeredPct: answeredTotal ? (100 * leads.reduce((a, l) => a + l.answered, 0)) / answeredTotal : null,
    estimatedPct: answeredTotal ? (100 * leads.reduce((a, l) => a + l.estimated, 0)) / answeredTotal : null,
    blankPct: answeredTotal ? (100 * leads.reduce((a, l) => a + l.blank, 0)) / answeredTotal : null,
    byPromptVersion: [...byVersion.entries()].map(([version, v]) => {
      const total = v.answered + v.estimated + v.blank;
      return {
        version,
        leads: v.leads,
        avgQuestionChars: mean(v.avgChars),
        answeredPct: total ? (100 * v.answered) / total : null,
        estimatedPct: total ? (100 * v.estimated) / total : null,
        blankPct: total ? (100 * v.blank) / total : null,
      };
    }),
    avgFeedbackRounds: mean(leads.filter((l) => l.feedbackRounds > 0 || l.manualVersions > 0 || l.sent).map((l) => l.feedbackRounds)),
    avgManualEditPct: mean(leads.map((l) => l.manualEditPct).filter((p): p is number => p !== null)),
    firstAttemptPct: calls.length ? (100 * firstTry) / calls.length : null,
    aiCalls: calls.length,
    failures,
    failuresByCategory: [...failuresByCategory.entries()].sort((a, b) => b[1] - a[1]),
  };
}

// ---- CSV (Dutch-locale Excel: semicolon separator, decimal comma, UTF-8 BOM) ----

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "number" ? String(Math.round(v * 1000) / 1000).replace(".", ",") : String(v);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Record<string, unknown>[]): string {
  const headers = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const lines = [headers.map(csvCell).join(";"), ...rows.map((r) => headers.map((h) => csvCell(r[h])).join(";"))];
  return `﻿${lines.join("\r\n")}\r\n`;
}
