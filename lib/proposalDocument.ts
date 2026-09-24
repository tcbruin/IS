import type { ProposalContent } from "./validation";

/**
 * Editor model for the Word-like proposal page. The stored proposal keeps plain strings; the
 * editor splits text fields into paragraphs (blank line = new paragraph) so Enter/Backspace can
 * behave like Word, and gives every paragraph a stable id so React never reuses the wrong
 * textarea after a split or merge. Pure — used by the client editor and the server alike.
 */

export type Para = { id: string; text: string };
export type Phase = { id: string; name: string; description: string };

export const TEXT_FIELDS = ["coverIntro", "situation", "approach", "investment", "nextSteps"] as const;
export const LIST_FIELDS = ["goals", "scopeDeliverables"] as const;
export type TextField = (typeof TEXT_FIELDS)[number];
export type ListField = (typeof LIST_FIELDS)[number];
export type ParaField = TextField | ListField;

export type EditorDoc = Record<ParaField, Para[]> & { phases: Phase[] };

/** Blank-line separated paragraphs; a single newline stays inside its paragraph (soft break). */
export function splitParagraphs(text: string): string[] {
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n[ \t]*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function paras(field: string, texts: string[]): Para[] {
  const list = texts.length ? texts : [""];
  return list.map((text, i) => ({ id: `${field}-${i}`, text }));
}

/** Deterministic initial ids, so server and client render identical markup. */
export function toEditorDoc(content: ProposalContent): EditorDoc {
  return {
    coverIntro: paras("coverIntro", splitParagraphs(content.coverIntro)),
    situation: paras("situation", splitParagraphs(content.situation)),
    approach: paras("approach", splitParagraphs(content.approach)),
    investment: paras("investment", splitParagraphs(content.investment)),
    nextSteps: paras("nextSteps", splitParagraphs(content.nextSteps)),
    goals: paras("goals", content.goals),
    scopeDeliverables: paras("scopeDeliverables", content.scopeDeliverables),
    phases: (content.timeline.phases.length ? content.timeline.phases : [{ name: "", description: "" }]).map(
      (p, i) => ({ id: `phase-${i}`, name: p.name, description: p.description }),
    ),
  };
}

function joinParas(list: Para[]): string {
  return list
    .map((p) => p.text.trim())
    .filter(Boolean)
    .join("\n\n");
}

/** Back to the stored shape. Empty paragraphs/items/phases are dropped, so the result may fail
 * proposalContentSchema (min 1) — that's how "section is empty" gets detected before saving. */
export function toProposalContent(doc: EditorDoc): ProposalContent {
  return normalizeProposalContent({
    coverIntro: joinParas(doc.coverIntro),
    situation: joinParas(doc.situation),
    approach: joinParas(doc.approach),
    investment: joinParas(doc.investment),
    nextSteps: joinParas(doc.nextSteps),
    goals: doc.goals.map((p) => p.text),
    scopeDeliverables: doc.scopeDeliverables.map((p) => p.text),
    timeline: { phases: doc.phases.map((p) => ({ name: p.name, description: p.description })) },
  });
}

function tidy(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Canonical form used on both sides of a manual save, so "unchanged" compares reliably. */
export function normalizeProposalContent(c: ProposalContent): ProposalContent {
  return {
    coverIntro: tidy(c.coverIntro),
    situation: tidy(c.situation),
    approach: tidy(c.approach),
    investment: tidy(c.investment),
    nextSteps: tidy(c.nextSteps),
    goals: c.goals.map(tidy).filter(Boolean),
    scopeDeliverables: c.scopeDeliverables.map(tidy).filter(Boolean),
    timeline: {
      phases: c.timeline.phases
        .map((p) => ({ name: tidy(p.name), description: tidy(p.description) }))
        .filter((p) => p.name || p.description),
    },
  };
}

export function countWords(content: ProposalContent): number {
  const all = [
    content.coverIntro,
    content.situation,
    content.approach,
    content.investment,
    content.nextSteps,
    ...content.goals,
    ...content.scopeDeliverables,
    ...content.timeline.phases.flatMap((p) => [p.name, p.description]),
  ].join(" ");
  return all.split(/\s+/).filter(Boolean).length;
}

// ---- Reducer ----

let counter = 0;
function newId(prefix: string): string {
  counter += 1;
  return `${prefix}-n${counter}`;
}

export type EditorAction =
  | { type: "setText"; field: ParaField; id: string; text: string }
  | { type: "split"; field: ParaField; id: string; before: string; after: string }
  | { type: "merge"; field: ParaField; id: string }
  | { type: "remove"; field: ParaField; id: string }
  | { type: "setPhase"; id: string; key: "name" | "description"; text: string }
  | { type: "addPhase"; afterId: string }
  | { type: "removePhase"; id: string }
  | { type: "reset"; doc: EditorDoc };

/** Where the caret should land after a structural edit (split/merge/add/remove). */
export type FocusTarget = { key: string; caret: number };

export function paraKey(field: ParaField, id: string): string {
  return `${field}:${id}`;
}

export function phaseKey(id: string, part: "name" | "description"): string {
  return `phase:${id}:${part}`;
}

/** Applies an action and reports where focus should go (if anywhere). */
export function applyEditorAction(doc: EditorDoc, action: EditorAction): { doc: EditorDoc; focus?: FocusTarget } {
  switch (action.type) {
    case "setText":
      return {
        doc: { ...doc, [action.field]: doc[action.field].map((p) => (p.id === action.id ? { ...p, text: action.text } : p)) },
      };
    case "split": {
      const list = doc[action.field];
      const i = list.findIndex((p) => p.id === action.id);
      if (i < 0) return { doc };
      const created: Para = { id: newId(action.field), text: action.after };
      const next = [...list.slice(0, i), { ...list[i], text: action.before }, created, ...list.slice(i + 1)];
      return { doc: { ...doc, [action.field]: next }, focus: { key: paraKey(action.field, created.id), caret: 0 } };
    }
    case "merge": {
      const list = doc[action.field];
      const i = list.findIndex((p) => p.id === action.id);
      if (i <= 0) return { doc };
      const prev = list[i - 1];
      const cur = list[i];
      const joiner = prev.text && cur.text && !/\s$/.test(prev.text) ? " " : "";
      const merged = { ...prev, text: prev.text + joiner + cur.text };
      const next = [...list.slice(0, i - 1), merged, ...list.slice(i + 1)];
      return {
        doc: { ...doc, [action.field]: next },
        focus: { key: paraKey(action.field, prev.id), caret: prev.text.length + joiner.length },
      };
    }
    case "remove": {
      const list = doc[action.field];
      if (list.length <= 1) return { doc };
      const i = list.findIndex((p) => p.id === action.id);
      if (i < 0) return { doc };
      const target = list[i - 1] ?? list[i + 1];
      return {
        doc: { ...doc, [action.field]: list.filter((p) => p.id !== action.id) },
        focus: { key: paraKey(action.field, target.id), caret: i > 0 ? target.text.length : 0 },
      };
    }
    case "setPhase":
      return {
        doc: { ...doc, phases: doc.phases.map((p) => (p.id === action.id ? { ...p, [action.key]: action.text } : p)) },
      };
    case "addPhase": {
      const i = doc.phases.findIndex((p) => p.id === action.afterId);
      const created: Phase = { id: newId("phase"), name: "", description: "" };
      const next = [...doc.phases.slice(0, i + 1), created, ...doc.phases.slice(i + 1)];
      return { doc: { ...doc, phases: next }, focus: { key: phaseKey(created.id, "name"), caret: 0 } };
    }
    case "removePhase": {
      if (doc.phases.length <= 1) return { doc };
      const i = doc.phases.findIndex((p) => p.id === action.id);
      const target = doc.phases[i - 1] ?? doc.phases[i + 1];
      return {
        doc: { ...doc, phases: doc.phases.filter((p) => p.id !== action.id) },
        focus: { key: phaseKey(target.id, "description"), caret: i > 0 ? target.description.length : 0 },
      };
    }
    case "reset":
      return { doc: action.doc };
  }
}
