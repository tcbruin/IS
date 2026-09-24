import type { Answer, Question } from "../validation";

export function outputLanguage(): string {
  return process.env.LLM_OUTPUT_LANGUAGE === "en" ? "en" : "nl";
}

export function languageInstruction(): string {
  return outputLanguage() === "en"
    ? "Write all output text in English."
    : "Schrijf alle uitvoertekst in het Nederlands.";
}

export function jsonOnlyInstruction(): string {
  return "Respond with a single JSON object only. No markdown code fences, no prose before or after the JSON.";
}

export function formatQA(questions: Question[], answers: Answer[]): string {
  return questions
    .map((q) => {
      const a = answers.find((x) => x.questionId === q.id);
      // Questions are deliberately short now; the hint carries the "why", so a terse answer
      // like "klopt" still has its context downstream.
      const context = q.hint ? ` (context: ${q.hint})` : "";
      return `Q: ${q.text}${context}\nA: ${a?.answer?.trim() || "(geen antwoord gegeven)"}`;
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
    "- Never include your own proposed answer, a \"Mijn voorstel/inschatting: …\", or an explanation in the question text.",
    "- Refer to details from the call briefly (e.g. \"de 3–4 uur per maandag\") instead of re-explaining them.",
    "- Optionally add a \"hint\" (max 12 words) saying WHY the answer matters for the proposal/dashboard — never a suggested answer.",
    "- If there are more topics than questions allowed, drop the least important topic. Never merge two topics into one question.",
    "- Each id is a short unique slug (e.g. \"scope\", \"uren-per-week\").",
    'Bad: "Het gesprek noemt meerdere pijnpunten (marge-inzicht, urenbriefjes, inkoopfacturen). Welk probleem kiezen we als scope? Mijn voorstel: het marge-overzicht — bevestig of corrigeer."',
    'Good: { "id": "scope", "text": "Welk probleem pakken we eerst aan: marge-inzicht of de urenbriefjes?", "hint": "Het voorstel draait om één probleem." }',
  ].join("\n");
}

export const QUESTIONS_JSON_SHAPE =
  'JSON shape: { "questions": [ { "id": string, "text": string, "hint"?: string } ] }';

/** Renders the consultant's own notes as an extra user-message block, or "" if none were given. */
export function notesBlock(notes?: string | null): string {
  if (!notes?.trim()) return "";
  return `Notities van de consultant (aanvullend op het transcript):\n\n${notes.trim()}`;
}

/** Renders the client's known source system (filled in at intake, never invented by the AI)
 * as an extra user-message block, or "" if none was given. */
export function sourceSystemBlock(sourceSystem?: string | null): string {
  if (!sourceSystem?.trim()) return "";
  return `Bronsysteem (waar de data van deze klant al uit gehaald gaat worden): ${sourceSystem.trim()}`;
}
