import type { Answer, Question } from "../validation";
import type { Locale } from "../i18n";

export function languageInstruction(locale: Locale = "en"): string {
  return locale === "nl"
    ? "Write all output text in natural, professional Dutch (Netherlands). Keep product and company names unchanged."
    : "Write all output text in English.";
}

export function jsonOnlyInstruction(): string {
  return "Respond with a single JSON object only. No markdown code fences, no prose before or after the JSON.";
}

export function formatQA(questions: Question[], answers: Answer[]): string {
  return questions
    .map((q) => {
      const a = answers.find((x) => x.questionId === q.id);
      // Questions are deliberately short now; the hint carries the "why", so a terse answer
      // like "correct" still has its context downstream.
      const context = q.hint ? ` (context: ${q.hint})` : "";
      return `Q: ${q.text}${context}\nA: ${a?.answer?.trim() || "(no answer given)"}`;
    })
    .join("\n\n");
}

/** Style rules shared by both question rounds: short, single-topic questions the account
 * owner can answer in a few words. */
export function shortQuestionRules(): string {
  return [
    "QUESTION STYLE — strict:",
    "- Each question asks exactly ONE thing. No sub-questions, no \"and/or\" chains. A choice between at most two named options is fine.",
    "- At most ~20 words (about 140 characters). Shorter is better.",
    "- Never include your own proposed answer, a \"My suggestion/estimate: …\", or an explanation in the question text.",
    "- Refer to details from the call briefly (e.g. \"the 3–4 hours every Monday\") instead of re-explaining them.",
    "- Optionally add a \"hint\" (max 12 words) saying WHY the answer matters for the proposal/dashboard — never a suggested answer.",
    "- If there are more topics than questions allowed, drop the least important topic. Never merge two topics into one question.",
    "- Each id is a short unique slug (e.g. \"scope\", \"hours-per-week\").",
    'Bad: "The call mentions several pain points (margin insight, timesheets, purchase invoices). Which problem do we choose as the scope? My suggestion: the margin overview — confirm or correct."',
    'Good: { "id": "scope", "text": "Which problem do we tackle first: margin insight or the timesheets?", "hint": "The proposal centers on one problem." }',
  ].join("\n");
}

export const QUESTIONS_JSON_SHAPE =
  'JSON shape: { "questions": [ { "id": string, "text": string, "hint"?: string } ] }';

/** Renders the consultant's own notes as an extra user-message block, or "" if none were given. */
export function notesBlock(notes?: string | null): string {
  if (!notes?.trim()) return "";
  return `Consultant's notes (in addition to the transcript):\n\n${notes.trim()}`;
}

/** Renders the client's known source system (filled in at intake, never invented by the AI)
 * as an extra user-message block, or "" if none was given. */
export function sourceSystemBlock(sourceSystem?: string | null): string {
  if (!sourceSystem?.trim()) return "";
  return `Source system (where this client's data will be pulled from): ${sourceSystem.trim()}`;
}
