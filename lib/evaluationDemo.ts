import type { Lead } from "./validation";
import type { TelemetryEvent, TelemetryEventInput, LLMStep } from "./telemetryEvents";
import { settingsSchema } from "./settings";

/** Illustrative fixtures only: never written into data/leads or sent to an AI. */
export const EVALUATION_DEMO_SETTINGS = settingsSchema.parse({
  baselineSource: "Illustrative assumption / Illustratieve aanname",
});

export function evaluationDemoRows(): { lead: Lead; events: TelemetryEvent[] }[] {
  const samples = [
    { name: "Kramer Bouwservice", minutes: 32, throughput: 85, sent: true, feedback: 1, edit: 12, score: 4 },
    { name: "Van Dijk Techniek", minutes: 41, throughput: 140, sent: true, feedback: 2, edit: 18, score: 4 },
    { name: "Verkerk Versdistributie", minutes: 28, throughput: 70, sent: true, feedback: 0, edit: 6, score: 5 },
    { name: "Noordhaven Logistiek", minutes: 54, throughput: 210, sent: true, feedback: 1, edit: 24, score: 3 },
    { name: "Delta Installaties", minutes: 19, throughput: 65, sent: false, feedback: 1, edit: 8, score: 4 },
    { name: "Westland Groothandel", minutes: 12, throughput: 35, sent: false, feedback: 0, edit: 0, score: 4 },
  ];
  return samples.map((sample, index) => {
    const start = Date.UTC(2026, 8, 21 + index, 8);
    let cursor = 0;
    const events: TelemetryEvent[] = [];
    const add = (event: TelemetryEventInput, minutes?: number) => {
      events.push({ ...event, v: 1, at: new Date(start + (minutes ?? cursor++) * 60000).toISOString() });
    };
    add({ type: "lead_created", source: "demo", transcriptChars: 6500 + index * 850, hasNotes: true, hasSourceSystem: true, intakeSeconds: 120 });
    const call = (step: LLMStep, ordinal: number, ok = true, attempts = 1) => add({
      type: "llm_call", step, model: "deepseek-chat", promptVersion: step === "proposal" ? "proposal-v5-four-blocks" : `${step}-demo-v1`,
      ok, attempts, durationMs: (9 + index * 3 + ordinal * 2) * 1000,
      promptTokens: (3400 + index * 500 + ordinal * 700) * attempts,
      completionTokens: (420 + ordinal * 210) * attempts,
      cacheHitTokens: (index % 2 ? 1200 : 2200) * attempts,
      ...(!ok ? { error: "Illustrative provider timeout" } : {}),
    });
    call("questions1", 0);
    add({ type: "questions_generated", round: 1, count: 5, avgChars: 72 + index * 8, maxChars: 120 + index * 8 });
    add({ type: "answers_submitted", round: 1, total: 5, answered: 4, estimated: 1, blank: 0, extraInfoFilled: true, isResubmit: false });
    if (index === 3) call("proposal", 1, false);
    call("proposal", 1, true, index === 1 ? 2 : 1);
    add({ type: "proposal_version_created", version: 1, source: "ai", withFeedback: false, commentedSections: [], warnings: 0 });
    for (let revision = 0; revision < sample.feedback; revision++) {
      call("proposal", revision + 2);
      add({ type: "proposal_version_created", version: revision + 2, source: "ai", withFeedback: true, commentedSections: ["approach"], warnings: 0 });
    }
    // One optional shortening call and one correctly classified readability warning.
    if (index === 4) {
      call("proposal", 4);
      add({ type: "proposal_version_created", version: 3, source: "ai", withFeedback: false, commentedSections: [], warnings: 1, warningCategories: ["length"] });
    }
    if (sample.edit) add({ type: "proposal_version_created", version: 5, source: "manual", withFeedback: false, commentedSections: [], warnings: 0, changedPctVsAi: sample.edit });
    if (index !== 5) {
      call("questions2", 2);
      add({ type: "answers_submitted", round: 2, total: 4, answered: 3, estimated: index === 2 ? 1 : 0, blank: index === 2 ? 0 : 1, extraInfoFilled: false, isResubmit: false });
      call("dashboard", 3);
      add({ type: "dashboard_generated", regeneration: false, warnings: 0 });
    }
    if (sample.sent) {
      call("coverEmail", 4);
      add({ type: "cover_email_generated" });
    }
    const steps = sample.sent ? ["call", "proposal", "dashboard", "send"] as const : ["call", "proposal"] as const;
    steps.forEach((step) => add({ type: "active_time", step, seconds: (sample.minutes - 2) * 60 / steps.length }));
    for (const artifact of ["questions", "proposal", ...(sample.sent ? ["dashboard", "email"] as const : [])] as const) {
      add({ type: "rating", artifact, score: artifact === "questions" ? Math.min(5, sample.score + 1) : sample.score });
    }
    add({ type: "baseline_estimate", minutes: 210 + index * 15 });
    add(sample.sent ? { type: "marked_sent" } : { type: "retro_comment", text: "Illustrative work in progress" }, sample.throughput);
    const state = sample.sent ? "sent" : index === 4 ? "dashboard_generated" : "proposal_generated";
    return { lead: {
      id: `evaluation-sample-${index + 1}`, companyName: sample.name, state,
      demo: { scenarioId: "evaluation-sample", mode: "replay" },
      createdAt: new Date(start).toISOString(), updatedAt: events[events.length - 1].at,
      stateHistory: [{ state, at: events[events.length - 1].at }],
    }, events };
  });
}
