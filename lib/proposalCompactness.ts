import type { ProposalContent } from "./validation";
import { countWords } from "./proposalDocument";

export const PROPOSAL_MAX_WORDS = 400;

const FIELD_LIMITS = {
  coverIntro: 90,
  situation: 45,
  goals: 35,
  approach: 90,
  scopeDeliverables: 85,
  timeline: 65,
  investment: 35,
  nextSteps: 35,
} as const;

function words(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function proposalCompactnessIssues(content: ProposalContent): string[] {
  const issues: string[] = [];
  const fieldWords = {
    coverIntro: words(content.coverIntro),
    situation: words(content.situation),
    goals: words(content.goals.join(" ")),
    approach: words(content.approach),
    scopeDeliverables: words(content.scopeDeliverables.join(" ")),
    timeline: words(content.timeline.phases.flatMap((p) => [p.name, p.description]).join(" ")),
    investment: words(content.investment),
    nextSteps: words(content.nextSteps),
  };

  const total = countWords(content);
  if (total > PROPOSAL_MAX_WORDS) issues.push(`total word count is ${total}; maximum is ${PROPOSAL_MAX_WORDS}`);
  for (const [field, count] of Object.entries(fieldWords)) {
    const limit = FIELD_LIMITS[field as keyof typeof FIELD_LIMITS];
    if (count > limit) issues.push(`${field} has ${count} words; maximum is ${limit}`);
  }
  if (content.goals.length > 2) issues.push(`goals has ${content.goals.length} items; maximum is 2`);
  if (content.scopeDeliverables.length > 4) issues.push(`scopeDeliverables has ${content.scopeDeliverables.length} items; maximum is 4`);
  if (content.timeline.phases.length > 3) issues.push(`timeline has ${content.timeline.phases.length} phases; maximum is 3`);
  return issues;
}

/** Preserve complete sentences and commitments if model shortening fails.
 * Rendered layout fitting handles overflow; never cut or silently omit content.
 */
export function compactProposalFallback(content: ProposalContent): ProposalContent {
  const tidy = (text: string) => text.trim().replace(/\s+/g, " ");
  return {
    coverIntro: tidy(content.coverIntro),
    situation: tidy(content.situation),
    goals: content.goals.map(tidy),
    approach: tidy(content.approach),
    scopeDeliverables: content.scopeDeliverables.map(tidy),
    timeline: { phases: content.timeline.phases.map((phase) => ({
      name: tidy(phase.name),
      description: tidy(phase.description),
    })) },
    investment: tidy(content.investment),
    nextSteps: tidy(content.nextSteps),
  };
}

export class ProposalLengthError extends Error {
  constructor(public readonly issues: string[]) {
    super("The AI could not meet the proposal length limits after three shortening attempts. Please retry generation. Your input does not need to be shortened.");
    this.name = "ProposalLengthError";
  }
}
