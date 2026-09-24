import { z } from "zod";
import { buildView, defaultFilters, generateDataset } from "./dashboardEngine";

/**
 * What the AI designs for a PoC dashboard: a small data model for the client's ONE problem
 * (entities, dimensions, periods, measures, derived measures), anchors quoted from the call,
 * and which KPIs/visuals/filters the page shows. It never writes a displayed number: code
 * (lib/dashboardEngine.js) generates illustrative rows from this spec and computes every value.
 *
 * zod limits are deliberately a bit generous so harmless overshoots don't cost a retry;
 * normalizeSpec() then clamps to what the fixed 1280×720 layout can hold.
 */

const key = z
  .string()
  .regex(/^[a-z][a-z0-9_]{1,23}$/, "Gebruik een korte sleutel: kleine letters, cijfers of _ (bijv. \"marge_pct\").");

const noDigits = (s: string) => !/\d/.test(s);
const label = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine(noDigits, "Geen cijfers in labels of titels — getallen toont het systeem zelf.");

const unit = z.enum(["euro", "count", "hours"]);

export const baseMeasureSchema = z.object({
  key,
  label: label(40),
  unit,
  higherIsBetter: z.boolean().default(true),
  /** Typical value per entity per period for an average-sized entity (generation setting). */
  typical: z.number().positive().optional(),
  spread: z.enum(["low", "medium", "high"]).default("medium"),
  trend: z.enum(["down", "flat", "up"]).default("flat"),
  /** Generate as a fraction of an earlier base measure, e.g. retour = 0.90–1.00 × geleverd. */
  relativeTo: z
    .object({ measure: key, min: z.number().positive(), max: z.number().positive() })
    .optional(),
});

export const derivedMeasureSchema = z.object({
  key,
  label: label(40),
  unit: z.enum(["euro", "count", "hours", "percent"]),
  higherIsBetter: z.boolean().default(true),
  /** add/subtract/divide use a and b; multiply = a × factor; balance = running total of a,
   * or of a − b when b is given (e.g. delivered − returned crates). */
  op: z.enum(["add", "subtract", "divide", "multiply", "balance"]),
  a: key,
  b: key.optional(),
  factor: z.number().positive().optional(),
});

export const anchorSchema = z.object({
  /** count: number of entities · level: latest-period total of a measure · threshold: a norm. */
  kind: z.enum(["count", "level", "threshold"]),
  measure: key.optional(),
  value: z.number(),
  /** Verbatim fragment from the transcript, notes or a concrete answer containing the number. */
  quote: z.string().trim().min(3).max(200),
});

const flagRule = z.enum(["threshold", "vsAverage", "vsPrevious"]);

export const kpiSchema = z.object({
  measure: key,
  label: label(40),
  /** flagCount: number of entities failing `flag` for this measure (e.g. "Projecten onder norm"). */
  show: z.enum(["value", "flagCount"]).default("value"),
  flag: flagRule.optional(),
});

export const tableSchema = z.object({
  type: z.literal("table"),
  title: label(60),
  /** "entity" or a dimension key. */
  rows: z.string(),
  columns: z.array(key).min(1).max(6),
  flag: z.object({ measure: key, rule: flagRule }).optional(),
  sortBy: key.optional(),
  sortDir: z.enum(["desc", "asc"]).default("desc"),
  limit: z.number().int().positive().optional(),
});

export const chartSchema = z.object({
  type: z.literal("chart"),
  title: label(60),
  /** "period", "entity" or a dimension key. */
  x: z.string(),
  series: z
    .array(z.object({ measure: key, style: z.enum(["bar", "line"]), running: z.boolean().optional() }))
    .min(1)
    .max(4),
});

const specObject = z.object({
  title: label(60),
  layout: z.enum(["overview", "openItems"]).default("overview"),
  model: z.object({
    entity: z.object({
      singular: label(24),
      plural: label(24),
      count: z.number().int().positive(),
      /** Fictional names for the largest entities — never real companies from the call. */
      names: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
      sizeSpread: z.enum(["even", "skewed"]).default("skewed"),
    }),
    dimensions: z
      .array(z.object({ key, label: label(24), values: z.array(z.string().trim().min(1).max(30)).min(2).max(12) }))
      .max(3)
      .default([]),
    period: z.object({ grain: z.enum(["week", "month"]), count: z.number().int().positive() }),
    measures: z.array(baseMeasureSchema).min(1).max(5),
    derived: z.array(derivedMeasureSchema).max(6).default([]),
  }),
  anchors: z.array(anchorSchema).max(6).default([]),
  kpis: z.array(kpiSchema).min(1).max(4),
  visuals: z.array(z.discriminatedUnion("type", [tableSchema, chartSchema])).min(1).max(3),
  filters: z.array(z.string()).max(3).default([]),
});

export type DashboardSpec = z.infer<typeof specObject>;
export type BaseMeasure = z.infer<typeof baseMeasureSchema>;
export type DerivedMeasure = z.infer<typeof derivedMeasureSchema>;
export type TableVisual = z.infer<typeof tableSchema>;
export type ChartVisual = z.infer<typeof chartSchema>;

/** Semantic checks. Messages list the valid keys, because callLLM sends them back to the
 * model on a retry. */
function checkSemantics(spec: DashboardSpec, ctx: z.RefinementCtx) {
  const issue = (message: string, path: (string | number)[]) =>
    ctx.addIssue({ code: z.ZodIssueCode.custom, message, path });
  const { model } = spec;

  const seen = new Set<string>();
  const dimKeys = model.dimensions.map((d) => d.key);
  for (const k of [...model.measures.map((m) => m.key), ...model.derived.map((m) => m.key), ...dimKeys]) {
    if (seen.has(k) || k === "entity" || k === "period") issue(`Sleutel "${k}" is dubbel of gereserveerd.`, ["model"]);
    seen.add(k);
  }

  const available: string[] = [];
  model.measures.forEach((m, i) => {
    if (m.relativeTo) {
      if (!available.includes(m.relativeTo.measure)) {
        issue(`relativeTo moet naar een eerdere basismaat wijzen (${available.join(", ") || "geen"}).`, ["model", "measures", i]);
      } else if (m.relativeTo.min > m.relativeTo.max) {
        issue("relativeTo.min mag niet groter zijn dan max.", ["model", "measures", i]);
      }
    } else if (!m.typical) {
      issue(`Maat "${m.key}" heeft "typical" nodig (of relativeTo).`, ["model", "measures", i]);
    }
    available.push(m.key);
  });

  const kinds: Record<string, string> = {};
  for (const m of model.measures) kinds[m.key] = "flow";
  model.derived.forEach((d, i) => {
    const path = ["model", "derived", i];
    const ok = (k: string | undefined) => k !== undefined && available.includes(k);
    if (!ok(d.a)) issue(`"a" moet een eerdere maat zijn: ${available.join(", ")}.`, path);
    const needsB = d.op === "add" || d.op === "subtract" || d.op === "divide";
    if (needsB && !ok(d.b)) issue(`Operatie ${d.op} heeft "b" nodig uit: ${available.join(", ")}.`, path);
    if (d.op === "multiply" && !d.factor) issue("multiply heeft een factor nodig.", path);
    const ka = kinds[d.a];
    const kb = d.b ? kinds[d.b] : undefined;
    if ((d.op === "add" || d.op === "subtract") && ka && kb && ka !== kb) {
      issue(`${d.op} combineert alleen maten van hetzelfde soort (${d.a}: ${ka}, ${d.b}: ${kb}).`, path);
    }
    if (d.op === "balance" && ka && ka !== "flow") issue("balance werkt alleen op een stroommaat.", path);
    if (d.op === "balance" && d.b !== undefined) {
      if (!ok(d.b)) issue(`balance: "b" moet een eerdere maat zijn: ${available.join(", ")}.`, path);
      else if (kb !== "flow") issue("balance: \"b\" moet ook een stroommaat zijn.", path);
    }
    if (d.op === "divide" && (ka === "ratio" || kb === "ratio")) issue("divide mag geen verhouding als invoer hebben.", path);
    if (d.unit === "percent" && d.op !== "divide") issue("Eenheid percent kan alleen bij divide.", path);
    if ((ka === "ratio") && d.op !== "divide") issue("Een verhouding kun je niet verder optellen of vermenigvuldigen.", path);
    kinds[d.key] = d.op === "balance" ? "stock" : d.op === "divide" ? "ratio" : (ka ?? "flow");
    available.push(d.key);
  });

  const measureKeys = available;
  const listKeys = measureKeys.join(", ");
  const groupKeys = ["entity", ...dimKeys];
  spec.anchors.forEach((a, i) => {
    const path = ["anchors", i];
    if (a.kind === "count") return;
    if (!a.measure || !measureKeys.includes(a.measure)) {
      issue(`Anker ${a.kind} heeft een bestaande maat nodig: ${listKeys}.`, path);
      return;
    }
    if (a.kind === "threshold" && kinds[a.measure] === "flow") {
      issue("Een drempel (threshold) kan alleen op een verhouding of saldo, niet op een stroommaat.", path);
    }
    if (a.kind === "level" && kinds[a.measure] === "ratio") issue("Een niveau-anker kan niet op een verhouding.", path);
  });

  const hasThreshold = (m: string) => spec.anchors.some((a) => a.kind === "threshold" && a.measure === m);
  spec.kpis.forEach((k, i) => {
    if (!measureKeys.includes(k.measure)) issue(`KPI-maat bestaat niet. Kies uit: ${listKeys}.`, ["kpis", i]);
    if (k.show === "flagCount" && !k.flag) issue("show flagCount heeft een flag nodig.", ["kpis", i]);
    if (k.flag === "threshold" && !hasThreshold(k.measure)) {
      issue("flag threshold heeft een threshold-anker op dezelfde maat nodig; gebruik anders vsAverage of vsPrevious.", ["kpis", i]);
    }
  });

  spec.visuals.forEach((v, i) => {
    const path = ["visuals", i];
    if (v.type === "table") {
      if (!groupKeys.includes(v.rows)) issue(`rows moet een van zijn: ${groupKeys.join(", ")}.`, path);
      for (const c of v.columns) if (!measureKeys.includes(c)) issue(`Kolom "${c}" bestaat niet. Kies uit: ${listKeys}.`, path);
      if (v.sortBy && !measureKeys.includes(v.sortBy)) issue(`sortBy moet een maat zijn: ${listKeys}.`, path);
      if (v.flag) {
        if (!measureKeys.includes(v.flag.measure)) issue(`flag.measure bestaat niet: ${listKeys}.`, path);
        else if (v.flag.rule === "threshold" && !hasThreshold(v.flag.measure)) {
          issue("flag threshold heeft een threshold-anker op dezelfde maat nodig; gebruik anders vsAverage of vsPrevious.", path);
        }
      }
    } else {
      if (![...groupKeys, "period"].includes(v.x)) issue(`x moet een van zijn: period, ${groupKeys.join(", ")}.`, path);
      for (const s of v.series) {
        if (!measureKeys.includes(s.measure)) issue(`Reeks "${s.measure}" bestaat niet. Kies uit: ${listKeys}.`, path);
        else if (s.running && kinds[s.measure] !== "flow") issue("running kan alleen bij een stroommaat.", path);
      }
    }
  });

  for (const f of spec.filters) {
    if (!groupKeys.includes(f)) issue(`Filter moet een van zijn: ${groupKeys.join(", ")}.`, ["filters"]);
  }
}

export const dashboardSpecSchema = specObject.superRefine(checkSemantics);

// ---- Normalisation: clamp to what the fixed layout can hold ----

const UNITS_PER_CHART = 2;

export function normalizeSpec(input: DashboardSpec): { spec: DashboardSpec; warnings: string[] } {
  const warnings: string[] = [];
  const spec: DashboardSpec = structuredClone(input);
  const m = spec.model;
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

  m.entity.count = clamp(m.entity.count, 3, 120);
  const [lo, hi] = m.period.grain === "week" ? [8, 26] : [6, 24];
  m.period.count = clamp(m.period.count, lo, hi);
  if (m.period.count % 2 === 1) m.period.count = Math.min(hi, m.period.count + 1);
  m.entity.names = m.entity.names.slice(0, 12);

  if (spec.visuals.length === 3) spec.layout = "openItems";
  if (spec.layout === "openItems" && !spec.visuals.some((v) => v.type === "table")) spec.layout = "overview";
  if (spec.layout === "overview" && spec.visuals.length > 2) {
    spec.visuals = spec.visuals.slice(0, 2);
    warnings.push("Er passen maximaal twee visuals op deze indeling; de derde is weggelaten.");
  }
  const maxKpis = spec.layout === "overview" ? 3 : 2;
  if (spec.kpis.length > maxKpis) spec.kpis = spec.kpis.slice(0, maxKpis);

  const units: Record<string, string> = {};
  for (const x of [...m.measures, ...m.derived]) units[x.key] = x.unit;
  for (const v of spec.visuals) {
    if (v.type !== "chart") continue;
    const allowed: string[] = [];
    v.series = v.series.filter((s) => {
      const u = units[s.measure];
      if (!allowed.includes(u)) {
        if (allowed.length >= UNITS_PER_CHART) return false;
        allowed.push(u);
      }
      return true;
    });
  }
  spec.filters = [...new Set(spec.filters)];
  return { spec, warnings };
}

/**
 * Builds the dataset and default view once on the server. Throws if anything comes out
 * non-finite (the dashboard must never show NaN); returns plausibility warnings otherwise.
 * A spec that can't be built fails the generation — there is deliberately no generic fallback
 * dashboard, because a generic one is exactly the misleading output this design replaces.
 */
export function dryRunDashboard(
  input: DashboardSpec,
  seed: string,
  generatedAt: string,
): { spec: DashboardSpec; warnings: string[] } {
  let spec = input;
  let ds = generateDataset(spec, seed, generatedAt);
  const warnings: string[] = [];

  // A norm is a per-row yardstick. A quoted number far outside the range of per-row values
  // (e.g. a total someone reported, used as a per-customer norm — 950 crates when customers
  // hold 5–180) is dropped; its flags then compare with the average instead. A real norm that
  // the illustrative rows merely don't reach (15% margin, rows at −5…14%) is kept.
  const flat = (key: string) => (ds.series as Record<string, number[][]>)[key];
  const unusable = spec.anchors.filter((a) => {
    if (a.kind !== "threshold" || !a.measure) return false;
    const def = [...spec.model.measures, ...spec.model.derived].find((m) => m.key === a.measure);
    let perRow: number[];
    const T = ds.periods.length;
    if (def && "op" in def && def.op === "divide") {
      const num = flat(def.a);
      const den = def.b ? flat(def.b) : undefined;
      if (!num || !den) return false;
      perRow = num.map((row, e) => {
        const n = row.reduce((x, y) => x + y, 0);
        const d = den[e].reduce((x, y) => x + y, 0);
        return d ? (def.unit === "percent" ? (n / d) * 100 : n / d) : NaN;
      });
    } else {
      const s = flat(a.measure);
      if (!s) return false;
      perRow = s.map((row) => row[T - 1]);
    }
    const valid = perRow.filter(Number.isFinite);
    if (!valid.length) return false;
    const lo = Math.min(...valid);
    const hi = Math.max(...valid);
    const width = Math.max(hi - lo, Math.abs(hi) * 0.1, 1e-9);
    return a.value < lo - width || a.value > hi + width;
  });
  if (unusable.length) {
    for (const a of unusable) {
      warnings.push(`"${a.quote}" is niet als norm gebruikt: het ligt ver buiten de waarden per rij; er wordt met het gemiddelde vergeleken.`);
    }
    const dropIdx = new Set(unusable.map((a) => spec.anchors.indexOf(a)));
    spec = structuredClone(spec);
    spec.anchors = spec.anchors.filter((_, i) => !dropIdx.has(i));
    const dropped = new Set(unusable.map((a) => a.measure));
    for (const k of spec.kpis) if (k.flag === "threshold" && dropped.has(k.measure)) k.flag = "vsAverage";
    for (const v of spec.visuals) {
      if (v.type === "table" && v.flag?.rule === "threshold" && dropped.has(v.flag.measure)) v.flag.rule = "vsAverage";
    }
    ds = generateDataset(spec, seed, generatedAt);
  }

  buildView(spec, ds, defaultFilters(ds));
  const series = ds.series as Record<string, number[][]>;
  for (const rows of Object.values(series)) {
    for (const row of rows) for (const v of row) if (!Number.isFinite(v)) throw new Error("Niet-eindige waarde in voorbeelddata.");
  }
  warnings.push(...ds.warnings);
  for (const d of spec.model.derived) {
    if (d.op !== "subtract") continue;
    const total = series[d.key].flat().reduce((a, b) => a + b, 0);
    if (total < 0) warnings.push(`Let op: "${d.label}" is in de voorbeelddata over de hele periode negatief.`);
  }
  return { spec, warnings };
}
