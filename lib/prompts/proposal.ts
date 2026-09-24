import type { Answer, ProposalContent, Question } from "../validation";
import { languageInstruction, jsonOnlyInstruction, formatQA, notesBlock, sourceSystemBlock } from "./shared";
import { DATAVANCE_PLAYBOOK } from "./playbook";

/** Logged with every call so evaluation can compare prompt iterations. Bump on meaningful edits. */
export const PROMPT_VERSION = "proposal-v2-keep-edits";

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
}): { system: string; user: string } {
  const system = [
    "You are a senior consultant at Datavance writing a client-facing sales proposal.",
    DATAVANCE_PLAYBOOK,
    "Base it on the call transcript, the consultant's own notes (if given), and the account owner's answers to clarifying questions.",
    "Write in a confident, concrete, concise style — short sentences, no filler, no generic consultant-speak.",
    "The proposal must center on the ONE scoped problem per the strategy above — 'scopeDeliverables' and 'timeline' describe work to solve that one problem, not a broad program.",
    input.sourceSystem
      ? "The client's source system is given below — name it concretely in 'approach' (e.g. \"we koppelen [systeem]\") instead of a vague \"jullie bestaande systemen\"."
      : "",
    "Some answers below may say the account owner has no concrete answer and asks you to estimate instead — that's expected, not a gap to leave blank. Make the most reasonable, concrete assumption grounded in the transcript and notes (never an unfounded invented specific), and write it into the proposal as a normal, confident statement rather than hedging or flagging it as a guess.",
    "Never invent concrete pricing figures — the investment section must stay a placeholder that frames it as a fixed price for this one scoped problem, to be confirmed on a scoping call.",
    "The company is always written as \"Datavance\" (lowercase v), never \"DataVance\".",
    input.examples?.length
      ? "Example proposals from other, unrelated clients are included below for tone/structure calibration only — never copy their client-specific facts, numbers, or names into the new proposal."
      : "",
    languageInstruction(),
    jsonOnlyInstruction(),
    `JSON shape:\n${PROPOSAL_JSON_SHAPE}`,
  ]
    .filter(Boolean)
    .join("\n");

  const parts = [
    `Transcript van het salesgesprek:\n\n${input.transcript}`,
    notesBlock(input.notes),
    sourceSystemBlock(input.sourceSystem),
    `Aanvullende vragen en antwoorden:\n\n${formatQA(input.questions, input.answers)}`,
  ].filter(Boolean);

  if (input.examples?.length) {
    parts.push(
      `Eerder goedgekeurde Datavance-voorstellen (andere klanten, alleen als referentie voor toon en structuur):\n\n${input.examples
        .map((e) => `## ${e.companyName}\n${JSON.stringify(e.content, null, 2)}`)
        .join("\n\n---\n\n")}`,
    );
  }

  if (input.priorDraft && input.feedback) {
    parts.push(
      `Vorig concept van het voorstel (JSON):\n\n${JSON.stringify(input.priorDraft, null, 2)}`,
    );
    parts.push(
      `Feedback van de accountmanager op dit concept — verwerk dit in een nieuwe versie. Pas alleen de onderdelen aan waar de feedback over gaat en neem alle andere secties letterlijk over: de accountmanager kan die zelf hebben bewerkt.\n\n${input.feedback}`,
    );
  }

  return { system, user: parts.join("\n\n---\n\n") };
}
