import type { Answer, ProposalContent, Question } from "../validation";
import { languageInstruction, jsonOnlyInstruction, formatQA, notesBlock, sourceSystemBlock } from "./shared";
import { DATAVANCE_PLAYBOOK } from "./playbook";
import type { Locale } from "../i18n";

/** Logged with every call so evaluation can compare prompt iterations. Bump on meaningful edits. */
export const PROMPT_VERSION = "proposal-v5-four-blocks";

const PROPOSAL_JSON_SHAPE = `{
  "coverIntro": string,        // short opening paragraph: who the client is, why this proposal
  "situation": string,         // the client's current situation and pain points, drawn from the call
  "goals": string[],           // the client's stated or implied goals
  "approach": string,          // the proposed solution/approach in prose
  "scopeDeliverables": string[], // concrete deliverables in scope
  "timeline": { "phases": [ { "name": string, "description": string } ] },
  "investment": string,        // a short placeholder note — do NOT invent real prices, say pricing follows a scoping call
  "nextSteps": string
}`;

export function buildProposalPrompt(input: {
  transcript: string;
  notes?: string;
  sourceSystem?: string;
  questions: Question[];
  answers: Answer[];
  priorDraft?: ProposalContent;
  feedback?: string;
  examples?: { companyName: string; content: ProposalContent }[];
  locale?: Locale;
}): { system: string; user: string } {
  const system = [
    "You are a senior consultant at Datavance writing a client-facing sales proposal.",
    DATAVANCE_PLAYBOOK,
    "Base it on the call transcript, the consultant's own notes (if given), and the account owner's answers to clarifying questions.",
    "Write in a confident, concrete, concise style — short sentences, no filler, no generic consultant-speak.",
    "Write a substantive one-page proposal of 350–400 words when the source material supports it. Use up to 2 goals, 4 deliverables and 3 timeline phases. Do not pad thin source material.",
    "The document has four visual blocks: opening/context/outcomes; Approach & deliverables; Planning & investment; Next step. The existing JSON fields are grouped under these blocks; retain every field.",
    "Write coverIntro as one continuous 65–90 word SCQA opening, without SCQA labels: Situation (shared client context), Complication (the one urgent problem and its impact), Question (one explicit decision question), then Answer (Datavance's concrete recommendation). Keep that exact order. Use situation for additional evidence and goals for measurable outcomes without repeating the opening.",
    "The remaining sections briefly support the Answer. Do not repeat the SCQA opening, problem statement, question, or recommendation.",
    "Suggested section budgets: coverIntro 80, situation 35, goals 25 total, approach 75, deliverables 65 total, timeline 55 total including names, investment 30, nextSteps 30. Keep the total near 400; explain the actual implementation, deliverables and outcome in complete sentences.",
    "The proposal must center on the ONE scoped problem per the strategy above — 'scopeDeliverables' and 'timeline' describe work to solve that one problem, not a broad program.",
    input.sourceSystem
      ? "The client's source system is given below — name it concretely in 'approach' (e.g. \"we connect [system]\") instead of a vague \"your existing systems\"."
      : "",
    "Some answers below may say the account owner has no concrete answer and asks you to estimate instead — that's expected, not a gap to leave blank. Make the most reasonable, concrete assumption grounded in the transcript and notes (never an unfounded invented specific), and write it into the proposal as a normal, confident statement rather than hedging or flagging it as a guess.",
    "Never invent concrete pricing figures — the investment section must stay a placeholder that frames it as a fixed price for this one scoped problem, to be confirmed on a scoping call.",
    "The company is always written as \"Datavance\" (lowercase v), never \"DataVance\".",
    input.examples?.length
      ? "Example proposals from other, unrelated clients are included below for tone/structure calibration only — never copy their client-specific facts, numbers, or names into the new proposal."
      : "",
    languageInstruction(input.locale),
    jsonOnlyInstruction(),
    `JSON shape:\n${PROPOSAL_JSON_SHAPE}`,
  ]
    .filter(Boolean)
    .join("\n");

  const parts = [
    `Sales call transcript:\n\n${input.transcript}`,
    notesBlock(input.notes),
    sourceSystemBlock(input.sourceSystem),
    `Clarifying questions and answers:\n\n${formatQA(input.questions, input.answers)}`,
  ].filter(Boolean);

  if (input.examples?.length) {
    parts.push(
      `Previously approved Datavance proposals (other clients, only as a reference for tone and structure):\n\n${input.examples
        .map((e) => `## ${e.companyName}\n${JSON.stringify(e.content, null, 2)}`)
        .join("\n\n---\n\n")}`,
    );
  }

  if (input.priorDraft && input.feedback) {
    parts.push(
      `Previous draft of the proposal (JSON):\n\n${JSON.stringify(input.priorDraft, null, 2)}`,
    );
    parts.push(
      `Feedback from the account owner on this draft — work it into a new version. Preserve unmentioned sections verbatim where they fit the length limits. If needed, shorten them while preserving the account owner's meaning and decisions; the one-page limits take precedence.\n\n${input.feedback}`,
    );
  }

  return { system, user: parts.join("\n\n---\n\n") };
}

export function buildProposalCompactionPrompt(content: ProposalContent, issues: string[], locale?: Locale): { system: string; user: string } {
  return {
    system: [
      "You are a senior consultant at Datavance compacting an existing client proposal so it fits on one A4 page.",
      "Preserve the essential supported facts, single-problem scope, intent, source-system references, and pricing restraint. Remove repetition and secondary detail; merge related deliverables and phases. Do not add facts or change commitments.",
      "Keep the coverIntro as an unlabeled Situation → Complication → explicit Question → Answer arc in 65–90 words. Never end a sentence mid-thought or insert ellipses to cut content.",
      "Aim for 350–400 words total. Use at most 2 goals, 4 deliverables and 3 phases. Section maximums: coverIntro 90; situation 45; goals 35 total; approach 90; deliverables 85 total; timeline 65 total INCLUDING names; investment 35; nextSteps 35. Use complete sentences, merge related details and remove repetition. Use one paragraph per text field.",
      languageInstruction(locale),
      jsonOnlyInstruction(),
      `JSON shape:\n${PROPOSAL_JSON_SHAPE}`,
    ].join("\n"),
    user: `Compact this proposal. It currently violates:\n- ${issues.join("\n- ")}\n\nProposal JSON:\n${JSON.stringify(content, null, 2)}`,
  };
}
