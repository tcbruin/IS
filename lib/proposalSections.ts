/** Single source of truth for the proposal's sections, in document order — used by the on-screen
 * document, the .docx export, and to compose per-section comments into the one feedback string
 * the API expects. `kind` says how a section renders. coverIntro is deliberately excluded: it's
 * the intro under the title, not a section with a heading. */
export const PROPOSAL_SECTIONS = [
  { key: "situation", label: "Situation", kind: "text" },
  { key: "goals", label: "Goals", kind: "list" },
  { key: "approach", label: "Approach", kind: "text" },
  { key: "scopeDeliverables", label: "Scope & deliverables", kind: "list" },
  { key: "timeline", label: "Timeline", kind: "phases" },
  { key: "investment", label: "Investment", kind: "callout" },
  { key: "nextSteps", label: "Next steps", kind: "text" },
] as const;

export type ProposalSectionKey = (typeof PROPOSAL_SECTIONS)[number]["key"];

const DUTCH_LABELS: Record<ProposalSectionKey, string> = {
  situation: "Situatie",
  goals: "Doelen",
  approach: "Aanpak",
  scopeDeliverables: "Scope & op te leveren onderdelen",
  timeline: "Planning",
  investment: "Investering",
  nextSteps: "Volgende stappen",
};

export function getProposalSections(locale: "en" | "nl" = "en") {
  return PROPOSAL_SECTIONS.map((section) => ({
    ...section,
    label: locale === "nl" ? DUTCH_LABELS[section.key] : section.label,
  }));
}

/** Composes per-section comments (keyed by ProposalSectionKey, empty/whitespace-only entries
 * ignored) into the single feedback string the proposal API already accepts. */
export function composeSectionFeedback(comments: Partial<Record<ProposalSectionKey, string>>, locale: "en" | "nl" = "en"): string {
  return getProposalSections(locale).map(({ key, label }) => {
    const text = comments[key]?.trim();
    return text ? `${label}: ${text}` : null;
  })
    .filter((line): line is string => line !== null)
    .join("\n\n");
}

/** Inverse of composeSectionFeedback: the per-section comments inside a feedback string. Any
 * paragraph without a known "Label:" prefix is collected under "general". */
export function splitSectionFeedback(feedback: string | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!feedback?.trim()) return out;
  for (const chunk of feedback.split(/\n\s*\n/)) {
    const text = chunk.trim();
    if (!text) continue;
    const section = [...PROPOSAL_SECTIONS, ...getProposalSections("nl")].find(({ label }) => text.startsWith(`${label}:`));
    const key = section ? section.key : "general";
    const body = section ? text.slice(section.label.length + 1).trim() : text;
    out[key] = out[key] ? `${out[key]}\n\n${body}` : body;
  }
  return out;
}

/** Which sections a feedback string comments on (for telemetry). */
export function parseSectionFeedback(feedback: string | null | undefined): string[] {
  return Object.keys(splitSectionFeedback(feedback));
}
