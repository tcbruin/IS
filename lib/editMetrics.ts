import type { ProposalContent } from "./validation";

/**
 * How much a human changed a proposal, for the evaluation ("the consultant rewrote 7% of the
 * AI draft"). Character-level edit distance per field, relative to the base text's length.
 */

function flatten(c: ProposalContent): Record<string, string> {
  return {
    coverIntro: c.coverIntro,
    situation: c.situation,
    goals: c.goals.join("\n"),
    approach: c.approach,
    scopeDeliverables: c.scopeDeliverables.join("\n"),
    timeline: c.timeline.phases.map((p) => `${p.name}\n${p.description}`).join("\n"),
    investment: c.investment,
    nextSteps: c.nextSteps,
  };
}

/** Levenshtein distance; trims the common prefix/suffix first so typical local edits are cheap. */
function editDistance(a: string, b: string): number {
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const s = a.slice(start, endA);
  const t = b.slice(start, endB);
  if (!s.length) return t.length;
  if (!t.length) return s.length;
  let prev = Array.from({ length: t.length + 1 }, (_, j) => j);
  let cur = new Array<number>(t.length + 1);
  for (let i = 1; i <= s.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= t.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (s[i - 1] === t[j - 1] ? 0 : 1));
    }
    [prev, cur] = [cur, prev];
  }
  return prev[t.length];
}

export function computeEditStats(base: ProposalContent, next: ProposalContent) {
  const a = flatten(base);
  const b = flatten(next);
  let distance = 0;
  let baseChars = 0;
  const sectionsChanged: string[] = [];
  for (const key of Object.keys(a)) {
    const d = editDistance(a[key], b[key]);
    distance += d;
    baseChars += a[key].length;
    if (d > 0) sectionsChanged.push(key);
  }
  return {
    changedPct: Math.round((1000 * distance) / Math.max(1, baseChars)) / 10,
    sectionsChanged,
  };
}
