const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const ts = require("typescript");
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
}).outputText, filename);
const { llmCostUsd } = require("../lib/llmPricing.ts");
const { leadMetrics, summarize, stepMetrics, toCsv } = require("../lib/evaluation.ts");
const { evaluationDemoRows, EVALUATION_DEMO_SETTINGS } = require("../lib/evaluationDemo.ts");
const { buildEvaluation, selectEvaluation, loadEvaluation } = require("../lib/evaluationData.ts");
const { evaluationExportRecords } = require("../lib/evaluationExport.ts");
const { leadSchema } = require("../lib/validation.ts");

const settings = { ...EVALUATION_DEMO_SETTINGS, hourlyRateEur: 60, usdToEur: 1 };
const row = (id, minutes, tokens, sent = true, model = "deepseek-chat") => {
  const lead = { ...evaluationDemoRows()[0].lead, id, demo: undefined };
  const event = (data, offset = 0) => ({ ...data, v: 1, at: new Date(Date.UTC(2026, 8, 25, 8, offset)).toISOString() });
  return { lead, events: [
    event({ type: "lead_created", source: "upload", transcriptChars: 1000, hasNotes: false, hasSourceSystem: false }),
    event({ type: "active_time", step: "proposal", seconds: minutes * 60 }, 1),
    event({ type: "llm_call", step: "proposal", model, promptVersion: "test", ok: true, attempts: 1, durationMs: 3000, promptTokens: 0, completionTokens: tokens, cacheHitTokens: 0 }, 2),
    ...(sent ? [event({ type: "marked_sent" }, 10)] : []),
  ] };
};

test("token/cache pricing and unknown models", () => {
  assert.equal(llmCostUsd({ model: "deepseek-chat", promptTokens: 1000000, cacheHitTokens: 500000, completionTokens: 1000000 }), 0.574);
  assert.equal(llmCostUsd({ model: "unknown", promptTokens: 1, cacheHitTokens: 0, completionTokens: 1 }), null);
  assert.equal(llmCostUsd({ model: "deepseek-chat", promptTokens: 100, cacheHitTokens: 200, completionTokens: 0 }), 100 * 0.028 / 1000000);
});

test("demo is deterministic, populated, complete and separate from actual data/settings", async () => {
  const rows = evaluationDemoRows();
  assert.deepEqual(rows, evaluationDemoRows());
  assert.equal(rows.length, 6);
  rows.forEach(({ lead }) => assert(leadSchema.safeParse(lead).success));
  const result = await loadEvaluation({ mode: "demo" });
  assert.equal(result.mode, "demo");
  assert.equal(result.provenance, "illustrative");
  assert.equal(result.summary.completedCount, 4);
  assert(result.summary.aiCostTotal > 0);
  assert.equal(result.summary.failures.filter((f) => f.category === "AI call failed").length, 1);
  assert.equal(result.summary.failures.filter((f) => f.category === "Invalid AI response, retried").length, 1);
  assert.equal(selectEvaluation([], settings).mode, "demo");
  assert.equal(selectEvaluation([], settings, "actual").metrics.length, 0);
  const actual = [row("real", 30, 1000)];
  assert.equal(selectEvaluation(actual, settings).mode, "actual");
  assert.equal(selectEvaluation(actual, settings).metrics.length, 1);
  assert.equal(selectEvaluation(actual, { ...settings, hourlyRateEur: 200 }, "demo").settings.hourlyRateEur, 95);
  assert.equal(actual.length, 1);
});

test("headline costs use median per-lead totals and the completed cohort", () => {
  const rows = [row("a", 1, 10000000), row("b", 2, 0), row("c", 3, 0), row("in-progress", 100, 20000000, false)];
  const data = buildEvaluation(rows, settings, "actual");
  assert.equal(data.summary.medianActiveMinutes, 2);
  assert.equal(data.summary.costPerLeadWithApp, 3);
  assert.equal(data.summary.savingsEur, 237);
  assert.equal(data.summary.savingsPct, 98.75);
  assert.equal(data.summary.aiCostPerLead, 0);
  assert(Math.abs(data.summary.aiCostTotal - 12.6) < 1e-10);
  assert.equal(data.summary.provisional, false);
  assert.equal(buildEvaluation([rows[3]], settings, "actual").summary.provisional, true);
});

test("missing pricing never becomes zero or creates misleading savings", () => {
  const rows = [row("known", 15, 1000000), row("unknown", 20, 1000000, true, "unknown")];
  const data = buildEvaluation(rows, settings, "actual");
  const unknown = data.metrics[1];
  assert.equal(unknown.aiCostEur, null);
  assert.equal(unknown.totalCostEur, null);
  assert.equal(unknown.savingsEur, null);
  assert.equal(data.summary.aiCostTotal, null);
  assert.equal(data.summary.knownAiCostTotal, 0.42);
  assert.equal(data.summary.costPerLeadWithApp, null);
  assert.equal(data.summary.savingsEur, null);
  assert.equal(data.steps[0].costEur, null);
  assert.equal(data.steps[0].knownCostEur, 0.42);
});

test("new proposal warnings are categorised and legacy warnings stay generic", () => {
  const sample = row("warning", 20, 0);
  for (const warningCategories of [undefined, ["length"], ["pricing"], ["pricing", "length"]]) {
    const events = [...sample.events, { v: 1, at: sample.lead.createdAt, type: "proposal_version_created", version: 1, source: "ai", withFeedback: false, commentedSections: [], warnings: 1, warningCategories }];
    const categories = leadMetrics(sample.lead, events, settings).failures.map((f) => f.category);
    assert.deepEqual(categories, warningCategories ? warningCategories.map((c) => c === "pricing" ? "Guardrail: amount in investment" : "Proposal length/readability") : ["Proposal warning"]);
  }
});

test("CSV records match page metrics and distinguish illustrative/unknown costs", () => {
  const data = selectEvaluation([], settings, "demo");
  const records = evaluationExportRecords(data, "leads");
  records.forEach((record, index) => {
    assert.equal(record.provenance, "illustrative");
    assert.equal(record.total_cost_eur, data.metrics[index].totalCostEur);
    assert.equal(record.savings_eur, data.metrics[index].savingsEur);
    assert.equal(record.consultant_cost_eur, data.metrics[index].consultantCostEur);
  });
  const events = evaluationExportRecords(data, "events");
  const eventSpend = events.reduce((sum, event) => sum + (event.cost_eur ?? 0), 0);
  assert(Math.abs(eventSpend - data.summary.aiCostTotal) < 1e-10);
  const csv = toCsv(records);
  assert(csv.startsWith("\ufeff"));
  assert(csv.includes("illustrative"));
  const unknown = buildEvaluation([row("unknown", 5, 100, true, "unknown")], settings, "actual");
  const unknownRecord = evaluationExportRecords(unknown, "leads")[0];
  assert.equal(unknownRecord.ai_cost_eur, null);
  assert.equal(unknownRecord.pricing_complete, false);
});
