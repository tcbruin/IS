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
 * v1-lang: long multi-part questions with embedded proposals. v2-kort: one topic, ≤20 words, hint.
 * v3-en: English prompts and output. */
export const PROMPT_VERSION = "q1-v3-en";

export function buildQuestions1Prompt(
  transcript: string,
  notes?: string,
  sourceSystem?: string,
): { system: string; user: string } {
  const system = [
    "You are a senior sales consultant at Datavance preparing to write a client proposal based on a sales call transcript.",
    DATAVANCE_PLAYBOOK,
    "Before drafting the proposal, you need to close the gaps the conversation left open.",
    "Generate 4 to 6 clarifying questions for the account owner (not the client) that would materially improve the proposal. Prioritize gaps along Datavance's discovery dimensions above — especially pinning down the ONE problem to scope, the current time/manual cost (for the time-savings case), and which systems the data actually lives in.",
    "Do not ask generic questions the transcript or notes already answer. If the source system is already given below, do not ask which system the data lives in — probe deeper instead (e.g. export/API access, data quality, who owns that system).",
    "The account owner answering these has the exact same transcript and notes you do — they cannot supply facts nobody has. Every question must be answerable either from something they actually know, or as a reasoned judgment call/assumption they're willing to make — never phrase a question as if it demands a hard fact that plausibly doesn't exist anywhere yet.",
    shortQuestionRules(),
    languageInstruction(),
    jsonOnlyInstruction(),
    QUESTIONS_JSON_SHAPE,
  ].join("\n");

  const user = [
    `Sales call transcript:\n\n${transcript}`,
    notesBlock(notes),
    sourceSystemBlock(sourceSystem),
  ]
    .filter(Boolean)
    .join("\n\n---\n\n");

  return { system, user };
}
