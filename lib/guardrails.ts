import { isAiEstimateAnswer, type Answer, type ProposalContent } from "./validation";
import type { DashboardSpec } from "./dashboardSpec";
import type { ProposalWarningCategory } from "./telemetryEvents";

const BRAND_NAME_TYPO = /\bDataVance\b/g;
// No `g` flag here on purpose — used only with .test(), and a shared global regex keeps
// stateful lastIndex across calls, which silently breaks repeated .test() checks.
const PRICE_PATTERN = /[€$£]\s?\d[\d.,]*|\d[\d.,]*\s?(euro|eur|dollar)/i;

function fixBrandNameDeep<T>(value: T): T {
  if (typeof value === "string") {
    return value.replace(BRAND_NAME_TYPO, "Datavance") as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => fixBrandNameDeep(item)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) out[key] = fixBrandNameDeep(val);
    return out as T;
  }
  return value;
}

/**
 * Catches playbook violations the prompt alone doesn't guarantee: auto-fixes the
 * "DataVance" capitalization typo everywhere, and flags (doesn't block) an invented
 * price in the investment section, since that's the one rule that's cheap to check
 * and genuinely risky to get wrong. A price typed by a human (manual edit) is deliberate —
 * that's exactly how real prices are meant to get in — so it isn't flagged.
 */
export function applyProposalGuardrails(
  content: ProposalContent,
  { source = "ai" }: { source?: "ai" | "manual" } = {},
): {
  content: ProposalContent;
  warnings: string[];
  warningCategories: ProposalWarningCategory[];
} {
  const fixed = fixBrandNameDeep(content);
  const warnings: string[] = [];
  if (source === "ai" && PRICE_PATTERN.test(fixed.investment)) {
    warnings.push(
      "The AI seems to mention a concrete amount in the investment section — that shouldn't be there. Check this before you share the proposal.",
    );
  }
  return { content: fixed, warnings, warningCategories: warnings.length ? ["pricing"] : [] };
}

// ---- Dashboard anchors: a number may only drive the dashboard if it was really said ----

/** Lowercase, no accents, thousands separators removed, punctuation collapsed. */
function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/(\d),(?=\d{3}\b)/g, "$1")
    .replace(/[^a-z0-9%]+/g, " ")
    .trim();
}

const SMALL: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90,
};
const SCALES: Record<string, number> = { hundred: 100, thousand: 1000 };

/** Written-out numbers in a normalized quote: "ninety three" → 93, "eighteen hundred" → 1800,
 * "two thousand five hundred" → 2500. A run of number words (with "and" inside it) is one number. */
function numberWordsIn(normalized: string): number[] {
  const out: number[] = [];
  let total = 0;
  let current = 0;
  let inRun = false;
  const flush = () => {
    if (inRun) out.push(total + current);
    total = current = 0;
    inRun = false;
  };
  for (const word of normalized.split(" ")) {
    if (word in SMALL) {
      // "ninety three" is one number; "six seven" (from "six, seven") is two.
      const joinsTens = current % 100 >= 20 && current % 10 === 0 && SMALL[word] < 10;
      if (inRun && current % 100 !== 0 && !joinsTens) flush();
      current += SMALL[word];
      inRun = true;
    } else if (word in SCALES && inRun) {
      if (SCALES[word] === 100) current *= 100;
      else {
        total += current * SCALES[word];
        current = 0;
      }
    } else if (word === "and" && inRun) {
      continue;
    } else {
      flush();
    }
  }
  flush();
  return out;
}

/** All numbers in a quote: digits (English notation, "1,800" / "12.5") and written-out words. */
function numbersIn(quote: string): number[] {
  const out: number[] = [];
  for (const m of quote.matchAll(/(\d+(?:[.,]\d+)*)\s*(mln|million|m|k|thousand)?\b/gi)) {
    const n = Number(m[1].replace(/,/g, ""));
    if (!Number.isFinite(n)) continue;
    out.push(n);
    // "4.8 mln" is also 4,800,000 and "45k" is also 45,000 — the anchor may use either form.
    const scale = m[2]?.toLowerCase();
    if (scale) out.push(n * (scale === "k" || scale === "thousand" ? 1e3 : 1e6));
  }
  out.push(...numberWordsIn(normalizeForMatch(quote)));
  return out;
}

function isEstimateAnswer(answer: string): boolean {
  return isAiEstimateAnswer(answer) || /estimate this yourself|your own estimate/i.test(answer);
}

/**
 * Brand-name fix, plus the anchor check behind "never invent numbers": every anchor quote must
 * appear verbatim in the transcript, the notes or a concrete (non-estimate) answer, and its
 * value must be a number in that quote. Failing anchors are dropped with a warning (never
 * blocking); flags that relied on a dropped norm fall back to "compared with the average".
 */
export function applyDashboardGuardrails(
  input: DashboardSpec,
  sources: { transcript: string; notes?: string; answers: Answer[] },
): { spec: DashboardSpec; warnings: string[] } {
  const spec = fixBrandNameDeep(structuredClone(input));
  const warnings: string[] = [];
  const haystack = normalizeForMatch(
    [sources.transcript, sources.notes ?? "", ...sources.answers.map((a) => a.answer).filter((a) => !isEstimateAnswer(a))].join("\n"),
  );
  const units: Record<string, string> = {};
  for (const m of [...spec.model.measures, ...spec.model.derived]) units[m.key] = m.unit;

  spec.anchors = spec.anchors.filter((anchor) => {
    const found = haystack.includes(normalizeForMatch(anchor.quote));
    let value = anchor.value;
    if (anchor.measure && units[anchor.measure] === "percent" && value > 0 && value < 1) value *= 100;
    const numbers = numbersIn(anchor.quote);
    // An explicit range ("8-10", "8 to 10 euros", "three or four hours") allows any value inside it.
    const isRange = /\d\s*[-–]\s*\d|\b(to|or)\b/i.test(anchor.quote);
    const matches =
      numbers.some((n) => Math.abs(n - value) < 1e-6) ||
      (isRange && numbers.length >= 2 && value >= Math.min(...numbers) && value <= Math.max(...numbers));
    if (!found || !matches) {
      warnings.push(
        `Figure from "${anchor.quote}" not used: ${!found ? "not found verbatim in the transcript, notes or answers" : "the number is not in this quote"}.`,
      );
      return false;
    }
    anchor.value = value;
    return true;
  });

  // Only one number can be "how many rows": keep the first count anchor.
  const count = spec.anchors.find((a) => a.kind === "count");
  spec.anchors = spec.anchors.filter((a) => {
    if (a.kind !== "count" || a === count) return true;
    warnings.push(`Figure from "${a.quote}" not used: there is already a number of ${spec.model.entity.plural.toLowerCase()} (${count?.value}).`);
    return false;
  });
  if (count) spec.model.entity.count = Math.round(count.value);

  const hasThreshold = (m: string) => spec.anchors.some((a) => a.kind === "threshold" && a.measure === m);
  for (const k of spec.kpis) if (k.flag === "threshold" && !hasThreshold(k.measure)) k.flag = "vsAverage";
  for (const v of spec.visuals) {
    if (v.type === "table" && v.flag?.rule === "threshold" && !hasThreshold(v.flag.measure)) v.flag.rule = "vsAverage";
  }
  return { spec, warnings };
}
