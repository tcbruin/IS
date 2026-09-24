// @ts-check
/**
 * Dashboard engine: turns an AI-designed DashboardSpec (lib/dashboardSpec.ts) into illustrative
 * data and a rendered 1280×720 report page. It generates the rows (seeded, so the same lead
 * always gets the same numbers), computes every displayed value, and renders KPI tiles,
 * tables and SVG charts as HTML strings.
 *
 * Deliberately plain JavaScript with ZERO imports: the exact same file runs on the server
 * (validation dry run), in the React live view, and inlined as source in the offline HTML
 * export (lib/dashboardExport.ts strips the `export` keywords). One engine, so the live page
 * and the export can never show different numbers.
 *
 * Measures behave in one of three ways over a filter context (entities × period window):
 * - flow  (base measures, add/subtract/multiply of flows): summed over the window;
 * - stock (balance, and sums of stocks): read at the end of the window;
 * - ratio (divide): numerator and denominator computed first, then divided (ratio of sums,
 *   like a Power BI measure), so a margin % stays correct under any filter.
 *
 * @typedef {import("./dashboardSpec").DashboardSpec} DashboardSpec
 * @typedef {{ x: number, y: number, w: number, h: number }} Slot
 * @typedef {{ entity: string, dims: Record<string, string>, from: number, to: number }} Filters
 */

export const PALETTE = ["#264549", "#FF5713", "#6B9EA3", "#FF9E00", "#97C1C4", "#FF4258", "#143034", "#FFC999"];

// ---------------------------------------------------------------------------------------------
// Randomness & dates (deterministic, UTC-only so server and browser agree)
// ---------------------------------------------------------------------------------------------

/** @param {string} s */
function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** @param {number} seed */
function mulberry32(seed) {
  let a = seed;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal via Box–Muller. @param {() => number} rand */
function gauss(rand) {
  const u = Math.max(rand(), 1e-9);
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const MONTHS_SHORT = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
const MONTHS_LONG = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];
const DAY_MS = 86400000;

/** ISO week number and ISO year of a UTC timestamp. @param {number} ms */
function isoWeek(ms) {
  const d = new Date(ms);
  const dayNum = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayNum + 3);
  const isoYear = d.getUTCFullYear();
  const jan4 = Date.UTC(isoYear, 0, 4);
  const jan4Day = (new Date(jan4).getUTCDay() + 6) % 7;
  const week = 1 + Math.round((d.getTime() - jan4) / DAY_MS / 7 + (jan4Day - 3) / 7);
  return { week, isoYear };
}

/** The last `count` complete weeks/months before `generatedAtIso`.
 * @param {"week"|"month"} grain @param {number} count @param {string} generatedAtIso */
function buildPeriods(grain, count, generatedAtIso) {
  const d = new Date(generatedAtIso);
  const out = [];
  if (grain === "month") {
    for (let i = count; i >= 1; i--) {
      let m = d.getUTCMonth() - i;
      let y = d.getUTCFullYear();
      while (m < 0) {
        m += 12;
        y -= 1;
      }
      out.push({ label: `${MONTHS_SHORT[m]} '${String(y).slice(2)}`, long: `${MONTHS_LONG[m]} ${y}` });
    }
    return out;
  }
  const dayNum = (d.getUTCDay() + 6) % 7;
  const monday = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - dayNum * DAY_MS;
  for (let i = count; i >= 1; i--) {
    const { week, isoYear } = isoWeek(monday - i * 7 * DAY_MS);
    out.push({ label: `wk ${week}`, long: `week ${week} ${isoYear}` });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Model helpers
// ---------------------------------------------------------------------------------------------

/** flow / stock / ratio per measure key. @param {DashboardSpec["model"]} model */
export function measureKinds(model) {
  /** @type {Record<string, "flow"|"stock"|"ratio">} */
  const kinds = {};
  for (const m of model.measures) kinds[m.key] = "flow";
  for (const d of model.derived) {
    kinds[d.key] = d.op === "balance" ? "stock" : d.op === "divide" ? "ratio" : kinds[d.a] ?? "flow";
  }
  return kinds;
}

/** @param {DashboardSpec["model"]} model */
function definitions(model) {
  /** @type {Record<string, any>} */
  const defs = {};
  for (const m of model.measures) defs[m.key] = m;
  for (const d of model.derived) defs[d.key] = d;
  return defs;
}

/** The independent base measure a base measure is generated from (follows relativeTo).
 * @param {DashboardSpec["model"]} model @param {string} key */
function rootBase(model, key) {
  let k = key;
  for (let guard = 0; guard < 10; guard++) {
    const m = model.measures.find((x) => x.key === k);
    if (!m || !m.relativeTo) return k;
    k = m.relativeTo.measure;
  }
  return k;
}

/** Root base measures a (derived) measure depends on. @param {DashboardSpec["model"]} model @param {string} key @returns {Set<string>} */
function rootsOf(model, key) {
  const d = model.derived.find((x) => x.key === key);
  if (!d) return new Set([rootBase(model, key)]);
  const out = rootsOf(model, d.a);
  if (d.b) for (const r of rootsOf(model, d.b)) out.add(r);
  return out;
}

// ---------------------------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------------------------

const SPREAD_SD = { low: 0.08, medium: 0.18, high: 0.32 };

/**
 * Generates the illustrative dataset for a spec. Deterministic for (spec, seed, generatedAt).
 * @param {DashboardSpec} spec @param {string} seed @param {string} generatedAtIso
 */
export function generateDataset(spec, seed, generatedAtIso) {
  const rand = mulberry32(hashString(seed));
  const model = spec.model;
  const n = model.entity.count;
  const T = model.period.count;
  const periods = buildPeriods(model.period.grain, T, generatedAtIso);
  /** @type {string[]} */
  const warnings = [];

  let sizes = Array.from({ length: n }, () =>
    model.entity.sizeSpread === "even" ? 0.8 + 0.4 * rand() : Math.exp(gauss(rand) * 0.7),
  );
  const meanSize = sizes.reduce((a, b) => a + b, 0) / n;
  sizes = sizes.map((s) => s / meanSize);

  // The AI's fictional names go to the largest entities, so they show up in top-N tables.
  const bySize = sizes.map((_, i) => i).sort((a, b) => sizes[b] - sizes[a]);
  /** @type {string[]} */
  const names = new Array(n);
  const pad = n >= 100 ? 3 : 2;
  bySize.forEach((idx, rank) => {
    names[idx] = model.entity.names[rank] || `${model.entity.singular} ${String(rank + 1).padStart(pad, "0")}`;
  });

  const perm = sizes.map((_, i) => i);
  for (let i = perm.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  /** @type {{ name: string, dims: Record<string, string> }[]} */
  const entities = names.map((name) => ({ name, dims: {} }));
  for (const dim of model.dimensions) {
    perm.forEach((e, p) => {
      entities[e].dims[dim.key] = dim.values[p % dim.values.length];
    });
  }

  /** @type {Record<string, number[][]>} */
  const base = {};
  for (const m of model.measures) {
    const rows = [];
    for (let e = 0; e < n; e++) {
      const row = new Array(T);
      if (m.relativeTo) {
        const parent = base[m.relativeTo.measure][e];
        const ratio = m.relativeTo.min + (m.relativeTo.max - m.relativeTo.min) * rand();
        for (let t = 0; t < T; t++) row[t] = Math.max(0, parent[t] * ratio * (1 + gauss(rand) * 0.03));
      } else {
        const sd = SPREAD_SD[m.spread] ?? 0.18;
        for (let t = 0; t < T; t++) {
          const progress = T > 1 ? t / (T - 1) : 1;
          const trend = m.trend === "up" ? 0.85 + 0.3 * progress : m.trend === "down" ? 1.15 - 0.3 * progress : 1;
          row[t] = Math.max(0, (m.typical ?? 1) * sizes[e] * trend * (1 + gauss(rand) * sd));
        }
      }
      rows.push(row);
    }
    base[m.key] = rows;
  }

  const ds = {
    spec,
    periods,
    entities,
    base,
    kinds: measureKinds(model),
    defs: definitions(model),
    /** @type {Record<string, number[][]>} */
    series: {},
    warnings,
  };

  calibrate(ds);
  for (const m of model.measures) {
    base[m.key] = base[m.key].map((row) => row.map((v) => Math.round(v)));
  }
  computeSeries(ds);
  return ds;
}

/** Scales generated data so each level anchor holds (e.g. total crate balance ≈ 1800).
 * Everything except divide is linear in the root base measures, so scaling those (and the
 * measures generated relative to them) by k scales the anchored measure by exactly k.
 * @param {any} ds */
function calibrate(ds) {
  const model = ds.spec.model;
  const T = ds.periods.length;
  const all = ds.entities.map((/** @type {any} */ _, /** @type {number} */ i) => i);
  const usedRoots = new Set();
  for (const a of ds.spec.anchors) {
    if (a.kind !== "level" || !a.measure || ds.kinds[a.measure] === "ratio") continue;
    const roots = rootsOf(model, a.measure);
    if ([...roots].some((r) => usedRoots.has(r))) {
      ds.warnings.push(`Anker op "${ds.defs[a.measure].label}" overgeslagen: het raakt dezelfde gegevens als een eerder anker.`);
      continue;
    }
    computeSeries(ds);
    const current = evaluate(ds, a.measure, all, T - 1, T - 1);
    if (current === null || !(current > 0) || !(a.value > 0)) continue;
    const k = a.value / current;
    for (const m of model.measures) {
      if (roots.has(rootBase(model, m.key))) {
        ds.base[m.key] = ds.base[m.key].map((/** @type {number[]} */ row) => row.map((v) => v * k));
      }
    }
    roots.forEach((r) => usedRoots.add(r));
  }
}

/** Per-entity, per-period series for every flow/stock measure. @param {any} ds */
function computeSeries(ds) {
  const model = ds.spec.model;
  const T = ds.periods.length;
  const series = ds.series;
  for (const m of model.measures) series[m.key] = ds.base[m.key];
  for (const d of model.derived) {
    if (d.op === "divide") continue;
    const a = series[d.a];
    const b = d.b ? series[d.b] : null;
    series[d.key] = a.map((/** @type {number[]} */ rowA, /** @type {number} */ e) => {
      if (d.op === "add") return rowA.map((v, t) => v + b[e][t]);
      if (d.op === "subtract") return rowA.map((v, t) => v - b[e][t]);
      if (d.op === "multiply") return rowA.map((v) => v * (d.factor ?? 1));
      // balance: running total of a (minus b when given, e.g. delivered − returned), with an
      // opening balance so it is never negative and looks like it has history (instead of
      // rising from zero at the start of the window).
      let run = 0;
      let minRun = 0;
      const prefix = rowA.map((v, t) => {
        run += b ? v - b[e][t] : v;
        minRun = Math.min(minRun, run);
        return run;
      });
      const meanNet = run / T;
      const opening = -minRun + T * Math.max(0, meanNet);
      return prefix.map((p) => opening + p);
    });
  }
}

/**
 * Value of a measure for a set of entities over periods [from, to]. Null if undefined
 * (e.g. division by zero).
 * @param {any} ds @param {string} key @param {number[]} ents @param {number} from @param {number} to
 * @returns {number | null}
 */
function evaluate(ds, key, ents, from, to) {
  const kind = ds.kinds[key];
  if (kind === "ratio") {
    const d = ds.defs[key];
    const num = evaluate(ds, d.a, ents, from, to);
    const den = evaluate(ds, d.b, ents, from, to);
    if (num === null || den === null || den === 0) return null;
    return d.unit === "percent" ? (num / den) * 100 : num / den;
  }
  const s = ds.series[key];
  let total = 0;
  if (kind === "stock") {
    for (const e of ents) total += s[e][to];
    return total;
  }
  for (const e of ents) for (let t = from; t <= to; t++) total += s[e][t];
  return total;
}

// ---------------------------------------------------------------------------------------------
// Formatting (hand-rolled Dutch format — no Intl, so server and browser output is identical)
// ---------------------------------------------------------------------------------------------

/** @param {number} v @param {number} decimals */
export function formatNumber(v, decimals = 0) {
  const neg = v < 0;
  const [int, dec] = Math.abs(v).toFixed(decimals).split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const out = grouped + (dec ? `,${dec}` : "");
  return neg && Number(Math.abs(v).toFixed(decimals)) !== 0 ? `-${out}` : out;
}

/**
 * @param {number | null | undefined} v @param {string} unit
 * @param {{ compact?: boolean, bare?: boolean }} [opts] bare: no € / u (table cells, axes)
 */
export function formatValue(v, unit, opts = {}) {
  if (v === null || v === undefined || !Number.isFinite(v)) return "–";
  if (unit === "percent") return `${formatNumber(v, 1)}%`;
  const abs = Math.abs(v);
  let s;
  if (opts.compact && abs >= 1e6) s = `${formatNumber(v / 1e6, 1)}M`;
  else if (opts.compact && abs >= 1e4) s = `${formatNumber(v / 1e3, 0)}K`;
  // Small non-whole values (e.g. € per uur) keep one decimal; sums of whole numbers don't.
  else s = formatNumber(v, abs < 100 && Math.abs(v - Math.round(v)) > 0.05 ? 1 : 0);
  if (opts.bare) return s;
  if (unit === "euro") return `€ ${s}`;
  if (unit === "hours") return `${s} u`;
  return s;
}

/** Local date-time "24-9-2026 16:12" (same machine for server + browser in this app). @param {string} iso */
export function formatDateTime(iso) {
  const d = new Date(iso);
  const pad = (/** @type {number} */ n) => String(n).padStart(2, "0");
  return `${d.getDate()}-${d.getMonth() + 1}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** @param {unknown} s */
export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

// ---------------------------------------------------------------------------------------------
// Layout: fixed slots on the 1280×720 canvas (content area x 40–1240, y 156–688)
// ---------------------------------------------------------------------------------------------

const KPI_H = 112;
const GAP = 16;

/** @param {DashboardSpec} spec */
function layoutSlots(spec) {
  const visuals = spec.visuals;
  if (spec.layout === "openItems" && visuals.length >= 2) {
    // Reference "Openstaande posten": KPIs + a table on the left, 1–2 visuals on the right.
    const tableIdx = Math.max(0, visuals.findIndex((v) => v.type === "table"));
    const order = [tableIdx, ...visuals.map((_, i) => i).filter((i) => i !== tableIdx)];
    const right = order.slice(1);
    /** @type {Slot[]} */
    const rightSlots =
      right.length === 1
        ? [{ x: 536, y: 156, w: 704, h: 532 }]
        : [
            { x: 536, y: 156, w: 704, h: 258 },
            { x: 536, y: 430, w: 704, h: 258 },
          ];
    return {
      kpis: { x: 40, y: 156, w: 480, h: KPI_H },
      visuals: [
        { index: order[0], slot: { x: 40, y: 156 + KPI_H + GAP, w: 480, h: 532 - KPI_H - GAP } },
        ...right.map((idx, i) => ({ index: idx, slot: rightSlots[i] })),
      ],
    };
  }
  // Reference "Overzicht": KPI row, then a wide visual (charts first) and a narrow one.
  const order = visuals.map((_, i) => i).sort((a, b) => Number(visuals[a].type === "table") - Number(visuals[b].type === "table"));
  const y = 156 + KPI_H + GAP;
  const h = 532 - KPI_H - GAP;
  /** @type {Slot[]} */
  const slots = order.length === 1 ? [{ x: 40, y, w: 1200, h }] : [
    { x: 40, y, w: 790, h },
    { x: 846, y, w: 394, h },
  ];
  return { kpis: { x: 40, y: 156, w: 1200, h: KPI_H }, visuals: order.slice(0, 2).map((idx, i) => ({ index: idx, slot: slots[i] })) };
}

const CARD_PAD = 14;
const CARD_TITLE = 34;
const ROW_H = 28;
const HEAD_H = 38;
const TOTAL_H = 30;

/** @param {Slot} slot */
function tableBudget(slot) {
  return {
    rows: Math.max(2, Math.floor((slot.h - 2 * CARD_PAD - CARD_TITLE - HEAD_H - TOTAL_H) / ROW_H)),
    cols: slot.w >= 1000 ? 5 : slot.w >= 700 ? 4 : slot.w >= 460 ? 3 : 2,
  };
}

// ---------------------------------------------------------------------------------------------
// View model
// ---------------------------------------------------------------------------------------------

/** Default window: the latest half of the periods, so a full previous window always exists
 * and every KPI shows its comparison on first view. Used by live page AND export.
 * @param {any} ds @returns {Filters} */
export function defaultFilters(ds) {
  const T = ds.periods.length;
  return { entity: "", dims: {}, from: Math.floor(T / 2), to: T - 1 };
}

/** @param {any} ds @param {number} from @param {number} to */
function rangeLabel(ds, from, to) {
  return from === to ? ds.periods[from].label : `${ds.periods[from].label} – ${ds.periods[to].label}`;
}

/** @param {any} ds @param {DashboardSpec} spec @param {string} measure */
function thresholdFor(ds, spec, measure) {
  const a = spec.anchors.find((x) => x.kind === "threshold" && x.measure === measure);
  return a ? a.value : null;
}

/** true = passes, false = fails, null = cannot tell.
 * @param {any} ds @param {DashboardSpec} spec @param {string} measure @param {string} rule
 * @param {number[]} ents group @param {number[]} context all entities in view
 * @param {number} from @param {number} to @param {{from:number,to:number}|null} prev */
function flagFor(ds, spec, measure, rule, ents, context, from, to, prev) {
  const def = ds.defs[measure];
  const value = evaluate(ds, measure, ents, from, to);
  if (value === null) return null;
  const better = (/** @type {number} */ a, /** @type {number} */ b) => (def.higherIsBetter ? a >= b : a <= b);
  if (rule === "threshold") {
    const thr = thresholdFor(ds, spec, measure);
    return thr === null ? null : better(value, thr);
  }
  if (rule === "vsAverage") {
    const kind = ds.kinds[measure];
    const ref =
      kind === "ratio"
        ? evaluate(ds, measure, context, from, to)
        : (evaluate(ds, measure, context, from, to) ?? 0) / Math.max(1, context.length / Math.max(1, ents.length));
    return ref === null ? null : better(value, ref);
  }
  if (!prev) return null;
  const before = evaluate(ds, measure, ents, prev.from, prev.to);
  return before === null ? null : better(value, before);
}

/** @param {string} rule @param {any} def @param {number|null} thr */
function flagHeader(rule, def, thr) {
  if (rule === "threshold" && thr !== null) return `Norm ${def.higherIsBetter ? "≥" : "≤"} ${formatValue(thr, def.unit)}`;
  if (rule === "vsAverage") return "vs gem.";
  return "vs vorige";
}

/** @param {number|null} cur @param {number|null} prev @param {any} def @param {string} prevLabel */
function deltaModel(cur, prev, def, prevLabel) {
  if (cur === null || prev === null) return null;
  let d;
  let text;
  if (def.unit === "percent") {
    d = cur - prev;
    text = `${d >= 0 ? "+" : ""}${formatNumber(d, 1)} pp`;
  } else {
    if (prev === 0) return null;
    d = ((cur - prev) / Math.abs(prev)) * 100;
    text = `${d >= 0 ? "+" : ""}${formatNumber(d, 1)}%`;
  }
  const tone = Math.abs(d) < 0.05 ? "neutral" : d > 0 === def.higherIsBetter ? "positive" : "negative";
  return { text: `${text} t.o.v. ${prevLabel}`, tone };
}

/**
 * Everything a renderer needs for the current filter state.
 * @param {DashboardSpec} spec @param {any} ds @param {Filters} filters
 */
export function buildView(spec, ds, filters) {
  const T = ds.periods.length;
  let from = Math.min(T - 1, Math.max(0, filters.from | 0));
  let to = Math.min(T - 1, Math.max(0, filters.to | 0));
  if (from > to) [from, to] = [to, from];
  const dims = filters.dims || {};
  /** @type {number[]} */
  const ents = ds.entities
    .map((/** @type {any} */ _, /** @type {number} */ i) => i)
    .filter(
      (/** @type {number} */ i) =>
        (!filters.entity || ds.entities[i].name === filters.entity) &&
        Object.entries(dims).every(([k, v]) => !v || ds.entities[i].dims[k] === v),
    );
  const len = to - from + 1;
  const prev = from - len >= 0 ? { from: from - len, to: from - 1 } : null;
  const prevLabel = prev ? rangeLabel(ds, prev.from, prev.to) : "";
  const layout = layoutSlots(spec);
  const kpiCharBudget = Math.floor((layout.kpis.w / Math.max(1, spec.kpis.length) - 40) / 24);

  const kpis = spec.kpis.map((k) => {
    const def = ds.defs[k.measure];
    if (k.show === "flagCount" && k.flag) {
      const count = (/** @type {number} */ f, /** @type {number} */ t, /** @type {any} */ p) =>
        ents.filter((e) => flagFor(ds, spec, k.measure, k.flag ?? "vsAverage", [e], ents, f, t, p) === false).length;
      const cur = count(from, to, prev);
      const before = prev && k.flag !== "vsPrevious" ? count(prev.from, prev.to, null) : null;
      return {
        label: k.label,
        value: formatNumber(cur),
        note: `van ${ents.length} ${ents.length === 1 ? spec.model.entity.singular.toLowerCase() : spec.model.entity.plural.toLowerCase()}`,
        delta: deltaModel(cur, before, { unit: "count", higherIsBetter: false }, prevLabel),
      };
    }
    const cur = evaluate(ds, k.measure, ents, from, to);
    const before = prev ? evaluate(ds, k.measure, ents, prev.from, prev.to) : null;
    const full = formatValue(cur, def.unit);
    const thr = thresholdFor(ds, spec, k.measure);
    return {
      label: k.label,
      value: full.length > kpiCharBudget ? formatValue(cur, def.unit, { compact: true }) : full,
      note: thr !== null ? `Norm ${def.higherIsBetter ? "≥" : "≤"} ${formatValue(thr, def.unit)}` : "",
      delta: deltaModel(cur, before, def, prevLabel),
    };
  });

  const visuals = layout.visuals.map(({ index, slot }) => {
    const v = spec.visuals[index];
    return v.type === "table" ? tableModel(spec, ds, v, slot, ents, from, to, prev) : chartModel(spec, ds, v, slot, ents, from, to);
  });

  const filterOptions = spec.filters.map((f) => {
    if (f === "entity") {
      return { key: "entity", label: spec.model.entity.singular, all: `Alle ${spec.model.entity.plural.toLowerCase()}`, options: ds.entities.map((/** @type {any} */ e) => e.name).sort() };
    }
    const dim = spec.model.dimensions.find((d) => d.key === f);
    return { key: f, label: dim ? dim.label : f, all: "Alle", options: dim ? [...dim.values] : [] };
  });

  return {
    kpiSlot: layout.kpis,
    kpis,
    visuals,
    filterOptions,
    periods: ds.periods.map((/** @type {any} */ p) => p.label),
    from,
    to,
  };
}

/** @param {DashboardSpec} spec @param {any} ds @param {any} v @param {Slot} slot @param {number[]} ents
 * @param {number} from @param {number} to @param {{from:number,to:number}|null} prev */
function tableModel(spec, ds, v, slot, ents, from, to, prev) {
  const budget = tableBudget(slot);
  // When the slot can't hold every column, keep the ones the table is about first: the flag
  // measure and the sort measure, then the rest in the AI's order.
  const priority = [v.flag?.measure, v.sortBy].filter((/** @type {any} */ c) => c && v.columns.includes(c));
  const columns = [...new Set([...priority, ...v.columns])]
    .slice(0, budget.cols)
    .sort((/** @type {string} */ a, /** @type {string} */ b) => v.columns.indexOf(a) - v.columns.indexOf(b));
  const narrow = slot.w < 460;
  const dim = spec.model.dimensions.find((d) => d.key === v.rows);
  const groups =
    v.rows === "entity"
      ? ents.map((e) => ({ label: ds.entities[e].name, ents: [e] }))
      : (dim ? dim.values : [])
          .map((value) => ({ label: value, ents: ents.filter((e) => ds.entities[e].dims[v.rows] === value) }))
          .filter((g) => g.ents.length > 0);

  const sortKey = v.sortBy && columns.includes(v.sortBy) ? v.sortBy : columns[0];
  const sortIdx = columns.indexOf(sortKey);
  const rows = groups.map((g) => ({
    label: g.label,
    values: columns.map((/** @type {string} */ c) => evaluate(ds, c, g.ents, from, to)),
    flag: v.flag ? flagFor(ds, spec, v.flag.measure, v.flag.rule, g.ents, ents, from, to, prev) : null,
  }));
  rows.sort((a, b) => {
    const x = a.values[sortIdx];
    const y = b.values[sortIdx];
    if (x === null) return 1;
    if (y === null) return -1;
    return v.sortDir === "asc" ? x - y : y - x;
  });
  const limit = Math.min(v.limit ?? Infinity, budget.rows);
  const units = columns.map((/** @type {string} */ c) => ds.defs[c].unit);
  const suffix = (/** @type {string} */ u) => (u === "euro" ? " (€)" : u === "hours" ? " (u)" : "");
  return {
    type: "table",
    slot,
    title: v.title,
    header: [
      v.rows === "entity" ? spec.model.entity.singular : dim ? dim.label : "",
      ...columns.map((/** @type {string} */ c, /** @type {number} */ i) => ds.defs[c].label + suffix(units[i])),
    ],
    flagHeader: v.flag ? flagHeader(v.flag.rule, ds.defs[v.flag.measure], thresholdFor(ds, spec, v.flag.measure)) : null,
    rows: rows.slice(0, limit).map((r) => ({
      label: r.label,
      cells: r.values.map((/** @type {number|null} */ val, /** @type {number} */ i) => cell(val, units[i])),
      flag: r.flag,
    })),
    total: columns.map((/** @type {string} */ c, /** @type {number} */ i) => cell(evaluate(ds, c, ents, from, to), units[i])),
    // Shown as "Totaal (93)" when not every row fits, so the total's scope is clear.
    rowCount: rows.length > limit ? rows.length : null,
  };

  /** Narrow tables abbreviate millions so numbers never get cut off.
   * @param {number|null} val @param {string} unit */
  function cell(val, unit) {
    const compact = narrow && val !== null && Math.abs(val) >= 1e6;
    return formatValue(val, unit, { bare: true, compact });
  }
}

/** @param {DashboardSpec} spec @param {any} ds @param {any} v @param {Slot} slot @param {number[]} ents
 * @param {number} from @param {number} to */
function chartModel(spec, ds, v, slot, ents, from, to) {
  /** @type {string[]} */
  let categories;
  /** @type {(key: string) => (number|null)[]} */
  let valuesFor;
  if (v.x === "period") {
    categories = ds.periods.slice(from, to + 1).map((/** @type {any} */ p) => p.label);
    valuesFor = (key) => categories.map((_, i) => evaluate(ds, key, ents, from + i, from + i));
  } else {
    const dim = spec.model.dimensions.find((d) => d.key === v.x);
    let groups =
      v.x === "entity"
        ? ents.map((e) => ({ label: ds.entities[e].name, ents: [e] }))
        : (dim ? dim.values : [])
            .map((value) => ({ label: value, ents: ents.filter((e) => ds.entities[e].dims[v.x] === value) }))
            .filter((g) => g.ents.length > 0);
    const first = v.series[0].measure;
    groups = groups
      .map((g) => ({ ...g, sortValue: evaluate(ds, first, g.ents, from, to) ?? -Infinity }))
      .sort((a, b) => b.sortValue - a.sortValue)
      .slice(0, slot.w >= 700 ? 10 : 6);
    categories = groups.map((g) => g.label);
    valuesFor = (key) => groups.map((g) => evaluate(ds, key, g.ents, from, to));
  }
  /** @type {string[]} */
  const units = [];
  const running = (/** @type {any} */ s) => Boolean(s.running) && v.x === "period";
  const hasPlain = v.series.some((/** @type {any} */ s) => !running(s));
  const series = v.series.map((/** @type {any} */ s, /** @type {number} */ i) => {
    const def = ds.defs[s.measure];
    if (!running(s) && !units.includes(def.unit)) units.push(def.unit);
    let values = valuesFor(s.measure);
    if (running(s)) {
      let run = 0;
      values = values.map((x) => (x === null ? null : (run += x)));
    }
    return {
      label: running(s) ? `${def.label} cumulatief` : def.label,
      unit: def.unit,
      style: s.style,
      // A cumulative series gets the right axis (as in the reference report), otherwise it
      // dwarfs the per-period bars; other series get an axis per unit.
      axis: running(s) && hasPlain ? 1 : Math.max(0, Math.min(1, units.indexOf(def.unit))),
      color: PALETTE[i % PALETTE.length],
      values,
    };
  });
  return { type: "chart", slot, title: v.title, categories, series };
}

// ---------------------------------------------------------------------------------------------
// Filter bar (shared markup; the live page and the export only wire up the events)
// ---------------------------------------------------------------------------------------------

const ICON_RESET =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 15 15 6a2 2 0 0 1 2.8 0l1.2 1.2a2 2 0 0 1 0 2.8L10 19H6v-4Z"/><path d="M13 8l4 4"/></svg>';
const ICON_FILTER =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 5h16l-6 8v5l-4 2v-7L4 5Z"/></svg>';
const ICON_MORE =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><circle cx="6" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="18" cy="12" r="1.6"/></svg>';

/** @param {string} value @param {string} label @param {boolean} selected */
function optionHtml(value, label, selected) {
  return `<option value="${escapeHtml(value)}"${selected ? " selected" : ""}>${escapeHtml(label)}</option>`;
}

/** Inner HTML of the white filter strip. @param {ReturnType<typeof buildView>} view @param {Filters} filters */
export function renderFilterBarHtml(view, filters) {
  const selects = view.filterOptions
    .map((f) => {
      const current = f.key === "entity" ? filters.entity : (filters.dims || {})[f.key] || "";
      return (
        `<label class="dv-field"><span>${escapeHtml(f.label)}</span><select data-filter="${escapeHtml(f.key)}">` +
        optionHtml("", f.all, !current) +
        f.options.map((/** @type {string} */ o) => optionHtml(o, o, o === current)).join("") +
        `</select></label>`
      );
    })
    .join("");
  const periodOptions = (/** @type {number} */ selected) =>
    view.periods.map((/** @type {string} */ p, /** @type {number} */ i) => optionHtml(String(i), p, i === selected)).join("");
  return (
    `<button type="button" class="dv-reset" data-reset title="Filters wissen" aria-label="Filters wissen">${ICON_RESET}</button>` +
    selects +
    `<label class="dv-field"><span>Periode</span><span class="dv-period">` +
    `<select data-period="from" aria-label="Periode vanaf">${periodOptions(view.from)}</select>` +
    `<select data-period="to" aria-label="Periode tot en met">${periodOptions(view.to)}</select>` +
    `</span></label>` +
    `<span class="dv-icons"><span class="dv-icon">${ICON_FILTER}</span><span class="dv-icon">${ICON_MORE}</span></span>`
  );
}

/** New filter state after a <select> in the filter bar changed. @param {Filters} filters
 * @param {{ dataset: Record<string, string | undefined>, value: string }} target @returns {Filters} */
export function applyFilterChange(filters, target) {
  const next = { ...filters, dims: { ...(filters.dims || {}) } };
  const { filter, period } = target.dataset;
  if (filter === "entity") next.entity = target.value;
  else if (filter) next.dims[filter] = target.value;
  else if (period === "from" || period === "to") {
    next[period] = Number(target.value);
    if (next.from > next.to) {
      if (period === "from") next.to = next.from;
      else next.from = next.to;
    }
  }
  return next;
}

// ---------------------------------------------------------------------------------------------
// Rendering (HTML strings; styling in components/dashboard/canvas.css, shared with the export)
// ---------------------------------------------------------------------------------------------

/** @param {Slot} s */
function pos(s) {
  return `left:${s.x}px;top:${s.y}px;width:${s.w}px;height:${s.h}px`;
}

/** The content area (KPIs + visuals) for a view. @param {ReturnType<typeof buildView>} view */
export function renderContentHtml(view) {
  const kpis = view.kpis
    .map(
      (k) =>
        `<div class="dv-kpi"><div class="dv-kpi-label">${escapeHtml(k.label)}</div>` +
        `<div class="dv-kpi-value">${escapeHtml(k.value)}</div>` +
        (k.note ? `<div class="dv-kpi-note">${escapeHtml(k.note)}</div>` : "") +
        (k.delta ? `<div class="dv-kpi-delta dv-tone-${k.delta.tone}">${escapeHtml(k.delta.text)}</div>` : "") +
        `</div>`,
    )
    .join("");
  const visuals = view.visuals
    .map((v) => {
      const body =
        v.type === "table"
          ? renderTableHtml(/** @type {any} */ (v))
          : renderChartSvg(/** @type {any} */ (v), v.slot.w - 2 * CARD_PAD - 2, v.slot.h - 2 * CARD_PAD - CARD_TITLE - 2);
      return `<div class="dv-card" style="${pos(v.slot)}"><div class="dv-card-title">${escapeHtml(v.title)}</div>${body}</div>`;
    })
    .join("");
  return `<div class="dv-kpis" style="${pos(view.kpiSlot)}">${kpis}</div>${visuals}`;
}

/** @param {any} t */
function renderTableHtml(t) {
  const flagCell = (/** @type {boolean|null} */ f) =>
    f === null ? `<td class="dv-flag"></td>` : `<td class="dv-flag"><span class="${f ? "dv-pass" : "dv-fail"}">${f ? "✓" : "✗"}</span></td>`;
  const head =
    `<tr><th>${escapeHtml(t.header[0])}</th>` +
    t.header.slice(1).map((/** @type {string} */ h) => `<th class="dv-num">${escapeHtml(h)}</th>`).join("") +
    (t.flagHeader ? `<th class="dv-flag">${escapeHtml(t.flagHeader)}</th>` : "") +
    `</tr>`;
  const body = t.rows
    .map(
      (/** @type {any} */ r) =>
        `<tr><td title="${escapeHtml(r.label)}">${escapeHtml(r.label)}</td>` +
        r.cells.map((/** @type {string} */ c) => `<td class="dv-num">${escapeHtml(c)}</td>`).join("") +
        (t.flagHeader ? flagCell(r.flag) : "") +
        `</tr>`,
    )
    .join("");
  const foot =
    `<tr><td>Totaal${t.rowCount ? ` <span class="dv-more">(${t.rowCount})</span>` : ""}</td>` +
    t.total.map((/** @type {string} */ c) => `<td class="dv-num">${escapeHtml(c)}</td>`).join("") +
    (t.flagHeader ? `<td class="dv-flag"></td>` : "") +
    `</tr>`;
  return `<table class="dv-table"><thead>${head}</thead><tbody>${body}</tbody><tfoot>${foot}</tfoot></table>`;
}

/** A step size of 1, 2, 2.5 or 5 × 10^k, at least `raw`. @param {number} raw */
function niceStep(raw) {
  if (!(raw > 0)) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / exp;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * exp;
}

/** Axis from min(0, data) to max with exactly 4 nice intervals. @param {number[]} values */
function niceAxis(values) {
  const max = Math.max(0, ...values);
  const min = Math.min(0, ...values);
  let step = niceStep((max - min) / 4 || 1);
  for (let guard = 0; guard < 5; guard++) {
    const lo = Math.floor(min / step) * step;
    if (lo + 4 * step >= max) return { lo, hi: lo + 4 * step };
    step = niceStep(step * 1.01);
  }
  return { lo: min, hi: max };
}

/** Power BI-style combo chart as SVG: bars and lines, max 2 value axes, 4 gridlines, pill
 * labels on the first and last point, legend on top. @param {any} chart @param {number} width @param {number} height */
export function renderChartSvg(chart, width, height) {
  const n = chart.categories.length;
  const hasRight = chart.series.some((/** @type {any} */ s) => s.axis === 1);
  const left = 54;
  const right = width - (hasRight ? 54 : 14);
  const top = 50;
  const bottom = height - 26;
  const plotW = Math.max(10, right - left);
  const band = plotW / Math.max(1, n);
  const parts = [];

  // Legend
  let lx = 2;
  for (const s of chart.series) {
    parts.push(
      s.style === "bar"
        ? `<rect x="${lx}" y="6" width="11" height="11" fill="${s.color}"/>`
        : `<line x1="${lx}" y1="11.5" x2="${lx + 12}" y2="11.5" stroke="${s.color}" stroke-width="3"/><circle cx="${lx + 6}" cy="11.5" r="3.5" fill="${s.color}"/>`,
      `<text x="${lx + 17}" y="16" class="dv-svg-legend">${escapeHtml(s.label)}</text>`,
    );
    lx += 17 + s.label.length * 6.6 + 18;
  }

  // Axes
  const axes = [0, 1].map((a) => {
    const vals = chart.series
      .filter((/** @type {any} */ s) => s.axis === a)
      .flatMap((/** @type {any} */ s) => s.values.filter((/** @type {any} */ v) => v !== null));
    const { lo, hi } = niceAxis(vals.length ? vals : [0, 1]);
    const unit = chart.series.find((/** @type {any} */ s) => s.axis === a)?.unit ?? "count";
    return { lo, hi, unit, y: (/** @type {number} */ v) => bottom - ((v - lo) / (hi - lo || 1)) * (bottom - top) };
  });
  for (let i = 0; i <= 4; i++) {
    const y = bottom - (i / 4) * (bottom - top);
    if (i > 0) parts.push(`<line x1="${left}" y1="${y}" x2="${right}" y2="${y}" class="dv-svg-grid"/>`);
    const v0 = axes[0].lo + (i / 4) * (axes[0].hi - axes[0].lo);
    parts.push(`<text x="${left - 8}" y="${y + 4}" text-anchor="end" class="dv-svg-axis">${escapeHtml(formatValue(v0, axes[0].unit, { compact: true, bare: true }))}</text>`);
    if (hasRight) {
      const v1 = axes[1].lo + (i / 4) * (axes[1].hi - axes[1].lo);
      parts.push(`<text x="${right + 8}" y="${y + 4}" class="dv-svg-axis">${escapeHtml(formatValue(v1, axes[1].unit, { compact: true, bare: true }))}</text>`);
    }
  }
  const zeroY = axes[0].y(0);
  parts.push(`<line x1="${left}" y1="${zeroY}" x2="${right}" y2="${zeroY}" class="dv-svg-axisline"/>`);

  // X labels (thinned so they never collide)
  const step = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(plotW / 46))));
  const maxChars = Math.max(3, Math.floor((band * step) / 6.4));
  chart.categories.forEach((/** @type {string} */ c, /** @type {number} */ i) => {
    if (i % step !== 0 && i !== n - 1) return;
    if (i === n - 1 && i % step !== 0 && (n - 1) % step < step / 2) return;
    const text = c.length > maxChars ? `${c.slice(0, maxChars - 1)}…` : c;
    parts.push(`<text x="${left + band * (i + 0.5)}" y="${bottom + 17}" text-anchor="middle" class="dv-svg-axis">${escapeHtml(text)}</text>`);
  });

  // Bars
  const bars = chart.series.filter((/** @type {any} */ s) => s.style === "bar");
  const groupW = band * (bars.length > 1 ? 0.78 : 0.58);
  const bw = Math.max(2, Math.min(34, groupW / Math.max(1, bars.length)));
  /** @type {string[]} */
  const pills = [];
  bars.forEach((/** @type {any} */ s, /** @type {number} */ j) => {
    const ax = axes[s.axis];
    s.values.forEach((/** @type {number|null} */ v, /** @type {number} */ i) => {
      if (v === null) return;
      const x = left + band * i + (band - bw * bars.length) / 2 + j * bw;
      const y0 = ax.y(0);
      const y1 = ax.y(v);
      parts.push(
        `<rect x="${x.toFixed(1)}" y="${Math.min(y0, y1).toFixed(1)}" width="${(bw - 1).toFixed(1)}" height="${Math.max(0.5, Math.abs(y1 - y0)).toFixed(1)}" fill="${s.color}"><title>${escapeHtml(`${chart.categories[i]} · ${s.label}: ${formatValue(v, s.unit)}`)}</title></rect>`,
      );
    });
    pushPills(pills, s, (i) => left + band * i + (band - bw * bars.length) / 2 + j * bw + bw / 2, (v) => ax.y(Math.max(0, v)) - 14, left, right, top);
  });

  // Lines
  for (const s of chart.series.filter((/** @type {any} */ x) => x.style === "line")) {
    const ax = axes[s.axis];
    const pts = s.values
      .map((/** @type {number|null} */ v, /** @type {number} */ i) => (v === null ? null : [left + band * (i + 0.5), ax.y(v)]))
      .filter(Boolean);
    parts.push(`<polyline points="${pts.map((/** @type {any} */ p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ")}" fill="none" stroke="${s.color}" stroke-width="2.5"/>`);
    s.values.forEach((/** @type {number|null} */ v, /** @type {number} */ i) => {
      if (v === null || n > 26) return;
      parts.push(`<circle cx="${(left + band * (i + 0.5)).toFixed(1)}" cy="${ax.y(v).toFixed(1)}" r="3.5" fill="${s.color}"><title>${escapeHtml(`${chart.categories[i]} · ${s.label}: ${formatValue(v, s.unit)}`)}</title></circle>`);
    });
    pushPills(pills, s, (i) => left + band * (i + 0.5), (v) => ax.y(v) - 14, left, right, top);
  }

  return `<svg class="dv-chart" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">${parts.join("")}${pills.join("")}</svg>`;
}

/** Pill value labels on the first and last point of a series (Power BI reference style).
 * @param {string[]} out @param {any} s @param {(i:number)=>number} xAt @param {(v:number)=>number} yAt
 * @param {number} minX @param {number} maxX @param {number} minY */
function pushPills(out, s, xAt, yAt, minX, maxX, minY) {
  const idx = s.values.map((/** @type {any} */ v, /** @type {number} */ i) => (v === null ? -1 : i)).filter((/** @type {number} */ i) => i >= 0);
  if (!idx.length) return;
  const picks = idx.length === 1 ? [idx[0]] : [idx[0], idx[idx.length - 1]];
  for (const i of picks) {
    const text = formatValue(s.values[i], s.unit, { compact: true, bare: s.unit !== "percent" });
    const w = text.length * 6.6 + 12;
    const cx = Math.min(maxX - w / 2, Math.max(minX + w / 2, xAt(i)));
    const cy = Math.max(minY - 6, yAt(s.values[i]));
    out.push(
      `<g><rect x="${(cx - w / 2).toFixed(1)}" y="${(cy - 9).toFixed(1)}" width="${w.toFixed(1)}" height="18" rx="9" fill="${s.color}"/>` +
        `<text x="${cx.toFixed(1)}" y="${(cy + 4).toFixed(1)}" text-anchor="middle" class="dv-svg-pill">${escapeHtml(text)}</text></g>`,
    );
  }
}
