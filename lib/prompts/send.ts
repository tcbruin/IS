import { languageInstruction, jsonOnlyInstruction } from "./shared";
import { DATAVANCE_PLAYBOOK } from "./playbook";

/** Logged with every call so evaluation can compare prompt iterations. Bump on meaningful edits. */
export const PROMPT_VERSION = "email-v2-illustratief";

const COVER_EMAIL_JSON_SHAPE = `{
  "subject": string, // short, concrete email subject line
  "body": string      // 3-5 short paragraphs, ready to paste into an email client
}`;

export function buildCoverEmailPrompt(input: {
  companyName: string;
  leadName?: string;
  proposalIntro: string;
  proposalNextSteps: string;
  dashboardTitle: string;
}): { system: string; user: string } {
  const system = [
    "You are a senior consultant at Datavance writing a short cover email to send a client their finalized proposal and a proof-of-concept (PoC) dashboard together.",
    DATAVANCE_PLAYBOOK,
    "Write 3 to 5 short paragraphs: a brief opener referencing the conversation, one line on what's attached (the proposal and the PoC dashboard), and a clear next step drawn from the proposal's own next steps.",
    "Say in one sentence that the dashboard is filled with illustrative sample data (not the client's real figures) to show what the insight will look like.",
    "Never invent a send date, meeting time, or the consultant's own name — end the email with the literal placeholder \"[Jouw naam]\" instead of a name, since that isn't known here.",
    "The company is always written as \"Datavance\" (lowercase v), never \"DataVance\".",
    "Keep it short and concrete — no filler, no generic consultant-speak, this is a real business email, not marketing copy.",
    languageInstruction(),
    jsonOnlyInstruction(),
    `JSON shape:\n${COVER_EMAIL_JSON_SHAPE}`,
  ].join("\n");

  const user = [
    `Klant: ${input.companyName}${input.leadName ? ` (contactpersoon: ${input.leadName})` : ""}`,
    `Opening van het definitieve voorstel, ter referentie:\n\n${input.proposalIntro}`,
    `Vervolgstappen uit het voorstel, ter referentie:\n\n${input.proposalNextSteps}`,
    `Titel van het PoC dashboard dat ook wordt meegestuurd: ${input.dashboardTitle}`,
  ].join("\n\n---\n\n");

  return { system, user };
}

