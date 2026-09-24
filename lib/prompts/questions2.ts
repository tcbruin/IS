import type { ProposalContent } from "../validation";
import {
  QUESTIONS_JSON_SHAPE,
  languageInstruction,
  jsonOnlyInstruction,
  notesBlock,
  shortQuestionRules,
  sourceSystemBlock,
} from "./shared";
import { DATAVANCE_PLAYBOOK } from "./playbook";

/** Logged with every call so evaluation can compare prompt iterations. Bump on meaningful edits.
 * v1-lang: long multi-part questions. v2-kort: one topic, ≤20 words, hint, slug ids. */
export const PROMPT_VERSION = "q2-v2-kort";

export function buildQuestions2Prompt(input: {
  transcript: string;
  notes?: string;
  sourceSystem?: string;
  proposal: ProposalContent;
}): { system: string; user: string } {
  const system = [
    "You are a senior consultant at Datavance about to design a 1-page proof-of-concept (PoC) dashboard to send alongside a finalized client proposal.",
    DATAVANCE_PLAYBOOK,
    "The dashboard illustrates the value of solving the ONE scoped problem from the proposal — not a broad reporting suite. Keep it tightly tied to that single problem's KPIs.",
    "Generate 3 to 5 clarifying questions for the account owner that would sharpen the dashboard: which measure matters most to this client, what they compare against (a norm, last period, other customers/projects), which breakdown they think in (per customer, per project, per driver…), and whether a number from the call is worth building around.",
    input.sourceSystem
      ? "The client's source system is already given below — do not ask which system the data lives in."
      : "",
    "The account owner answering these has the exact same transcript and notes you do — they cannot supply facts nobody has. Every question must be answerable either from something they actually know, or as a reasoned judgment call/assumption they're willing to make — never phrase a question as if it demands a hard fact that plausibly doesn't exist anywhere yet.",
    shortQuestionRules(),
    languageInstruction(),
    jsonOnlyInstruction(),
    QUESTIONS_JSON_SHAPE,
  ]
    .filter(Boolean)
    .join("\n");

  const user = [
    `Transcript van het salesgesprek:\n\n${input.transcript}`,
    notesBlock(input.notes),
    sourceSystemBlock(input.sourceSystem),
    `Definitief voorstel (JSON):\n\n${JSON.stringify(input.proposal, null, 2)}`,
  ]
    .filter(Boolean)
    .join("\n\n---\n\n");

  return { system, user };
}
