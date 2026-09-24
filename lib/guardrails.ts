import { AI_ESTIMATE_SENTINEL, type Answer, type ProposalContent } from "./validation";
import type { DashboardSpec } from "./dashboardSpec";

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
} {
  const fixed = fixBrandNameDeep(content);
  const warnings: string[] = [];
  if (source === "ai" && PRICE_PATTERN.test(fixed.investment)) {
    warnings.push(
      "De AI lijkt een concreet bedrag te noemen in de investeringssectie — dat hoort niet. Controleer dit voor je het voorstel deelt.",
    );
  }
  return { content: fixed, warnings };
}

// ---- Dashboard anchors: a number may only drive the dashboard if it was really said ----

/** Lowercase, no accents, thousands separators removed, punctuation collapsed. */
function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/(\d)\.(?=\d{3}\b)/g, "$1")
    .replace(/[^a-z0-9%]+/g, " ")
    .trim();
}

const UNITS: Record<string, number> = {
  een: 1, twee: 2, drie: 3, vier: 4, vijf: 5, zes: 6, zeven: 7, acht: 8, negen: 9, tien: 10,
  elf: 11, twaalf: 12, dertien: 13, veertien: 14, vijftien: 15, zestien: 16, zeventien: 17,
  achttien: 18, negentien: 19,
};
const TENS: Record<string, number> = {
  twintig: 20, dertig: 30, veertig: 40, vijftig: 50, zestig: 60, zeventig: 70, tachtig: 80, negentig: 90,
};

/** "drieennegentig" → 93, "achttienhonderd" → 1800, "vijftien" → 15; null if not a number. */
function parseDutchNumberWord(word: string): number | null {
  // "een" is also the article ("a"), so on its own it never counts as a number.
  if (!word || word === "een") return null;
  if (word in UNITS) return UNITS[word];
  if (word in TENS) return TENS[word];
  const compound = word.match(/^([a-z]+?)en([a-z]+)$/);
  if (compound && compound[1] in UNITS && compound[2] in TENS && UNITS[compound[1]] < 10) {
    return UNITS[compound[1]] + TENS[compound[2]];
  }
  for (const [suffix, factor] of [["duizend", 1000], ["honderd", 100]] as const) {
    const i = word.indexOf(suffix);
    if (i >= 0) {
      const head = word.slice(0, i);
      const tail = word.slice(i + suffix.length);
      const h = head ? parseDutchNumberWord(head) : 1;
      const t = tail ? parseDutchNumberWord(tail) : 0;
      if (h !== null && t !== null) return h * factor + t;
    }
  }
  return null;
}

/** All numbers in a quote: digits (Dutch notation) and written-out number words. */
function numbersIn(quote: string): number[] {
  const out: number[] = [];
  for (const m of quote.match(/\d+(?:[.,]\d+)*/g) ?? []) {
    const n = /^\d{1,3}(\.\d{3})+$/.test(m) ? Number(m.replace(/\./g, "")) : Number(m.replace(/\./g, "").replace(",", "."));
    if (Number.isFinite(n)) out.push(n);
  }
  for (const word of normalizeForMatch(quote).split(" ")) {
    const n = parseDutchNumberWord(word);
    if (n !== null) out.push(n);
  }
  return out;
}

function isEstimateAnswer(answer: string): boolean {
  return answer === AI_ESTIMATE_SENTINEL || /schat dit zelf in|eigen inschatting/i.test(answer);
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
    // An explicit range ("8-10", "8 tot 10 euro") allows any value inside it.
    const isRange = /\d\s*(-|–|tot)\s*\d/.test(anchor.quote);
    const matches =
      numbers.some((n) => Math.abs(n - value) < 1e-6) ||
      (isRange && numbers.length >= 2 && value >= Math.min(...numbers) && value <= Math.max(...numbers));
    if (!found || !matches) {
      warnings.push(
        `Cijfer uit "${anchor.quote}" niet gebruikt: ${!found ? "niet letterlijk gevonden in transcript, notities of antwoorden" : "het getal staat niet in dit citaat"}.`,
      );
      return false;
    }
    anchor.value = value;
    return true;
  });

  const count = spec.anchors.find((a) => a.kind === "count");
  if (count) spec.model.entity.count = Math.round(count.value);

  const hasThreshold = (m: string) => spec.anchors.some((a) => a.kind === "threshold" && a.measure === m);
  for (const k of spec.kpis) if (k.flag === "threshold" && !hasThreshold(k.measure)) k.flag = "vsAverage";
  for (const v of spec.visuals) {
    if (v.type === "table" && v.flag?.rule === "threshold" && !hasThreshold(v.flag.measure)) v.flag.rule = "vsAverage";
  }
  return { spec, warnings };
}
