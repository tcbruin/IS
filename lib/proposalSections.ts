/** Single source of truth for the proposal's sections, in document order — used by the on-screen
 * document, the .docx export, and to compose per-section comments into the one feedback string
 * the API expects. `kind` says how a section renders. coverIntro is deliberately excluded: it's
 * the intro under the title, not a section with a heading. */
export const PROPOSAL_SECTIONS = [
  { key: "situation", label: "Situatie", kind: "text" },
  { key: "goals", label: "Doelstellingen", kind: "list" },
  { key: "approach", label: "Aanpak", kind: "text" },
  { key: "scopeDeliverables", label: "Scope & deliverables", kind: "list" },
  { key: "timeline", label: "Tijdlijn", kind: "phases" },
  { key: "investment", label: "Investering", kind: "callout" },
  { key: "nextSteps", label: "Vervolgstappen", kind: "text" },
] as const;

export type ProposalSectionKey = (typeof PROPOSAL_SECTIONS)[number]["key"];

/** Composes per-section comments (keyed by ProposalSectionKey, empty/whitespace-only entries
 * ignored) into the single feedback string the proposal API already accepts. */
export function composeSectionFeedback(comments: Partial<Record<ProposalSectionKey, string>>): string {
  return PROPOSAL_SECTIONS.map(({ key, label }) => {
    const text = comments[key]?.trim();
    return text ? `${label}: ${text}` : null;
  })
    .filter((line): line is string => line !== null)
    .join("\n\n");
}

/** Inverse of composeSectionFeedback: which sections a feedback string comments on (for
 * telemetry). Any paragraph without a known "Label:" prefix counts as "algemeen". */
export function parseSectionFeedback(feedback: string | null | undefined): string[] {
  if (!feedback?.trim()) return [];
  const found = new Set<string>();
  for (const chunk of feedback.split(/\n\s*\n/)) {
    const text = chunk.trim();
    if (!text) continue;
    const section = PROPOSAL_SECTIONS.find(({ label }) => text.startsWith(`${label}:`));
    found.add(section ? section.key : "algemeen");
  }
  return [...found];
}
