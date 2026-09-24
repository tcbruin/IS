import { LEAD_STATES, type LeadState } from "./validation";
import type { StepKey } from "./telemetryEvents";

export type { StepKey };

export const STATE_ORDER = LEAD_STATES;

export const STATE_LABELS: Record<LeadState, string> = {
  transcript_uploaded: "Transcript geupload",
  questions1_generated: "Verduidelijkingsvragen klaar",
  questions1_answered: "Antwoorden ontvangen",
  proposal_generated: "Voorstel in review",
  proposal_finalized: "Voorstel definitief",
  questions2_generated: "Dashboardvragen klaar",
  questions2_answered: "Dashboardantwoorden ontvangen",
  dashboard_generated: "Dashboard klaar",
  sent: "Verzonden",
};

/** Which page a state's work continues on — the `/leads/[id]` redirect target ("Verder waar je
 * was"). Always the page of the step the lead is active in, matching the step bar. */
export const STEP_ROUTES: Record<LeadState, string> = {
  transcript_uploaded: "questions",
  questions1_generated: "questions",
  questions1_answered: "proposal",
  proposal_generated: "proposal",
  proposal_finalized: "dashboard-questions",
  questions2_generated: "dashboard-questions",
  questions2_answered: "dashboard",
  dashboard_generated: "send",
  sent: "send",
};

/**
 * The 4 user-facing steps and their substeps. Each has two thresholds instead of owning a
 * slice of states: `from` (reachable once the lead is at or past it) and `doneAt` (done once
 * at or past it). One state can therefore finish step 2 and open step 3 at the same time.
 * Which step is *highlighted* is decided by the page being viewed (see LeadHeader), not by the
 * state — so the step bar can never contradict the screen.
 */
export type Substep = { key: string; label: string; route: string; from: LeadState; doneAt: LeadState };
export type Step = {
  key: StepKey;
  number: 1 | 2 | 3 | 4;
  label: string;
  description: string;
  from: LeadState;
  doneAt: LeadState;
  substeps: Substep[];
};

export const STEPS: Step[] = [
  {
    key: "gesprek",
    number: 1,
    label: "Gesprek",
    description: "Transcript en notities; de AI stelt verduidelijkingsvragen die jij beantwoordt.",
    from: "transcript_uploaded",
    doneAt: "questions1_answered",
    substeps: [
      { key: "transcript", label: "Transcript & notities", route: "questions", from: "transcript_uploaded", doneAt: "questions1_generated" },
      { key: "vragen", label: "Vragen beantwoorden", route: "questions", from: "questions1_generated", doneAt: "questions1_answered" },
    ],
  },
  {
    key: "voorstel",
    number: 2,
    label: "Voorstel",
    description: "De AI schrijft een concept; jij bewerkt het, vraagt aanpassingen en maakt het definitief.",
    from: "questions1_answered",
    doneAt: "proposal_finalized",
    substeps: [
      { key: "concept", label: "Concept", route: "proposal", from: "questions1_answered", doneAt: "proposal_generated" },
      { key: "bewerken", label: "Bewerken & feedback", route: "proposal", from: "proposal_generated", doneAt: "proposal_finalized" },
      { key: "definitief", label: "Definitief", route: "proposal", from: "proposal_finalized", doneAt: "proposal_finalized" },
    ],
  },
  {
    key: "dashboard",
    number: 3,
    label: "Dashboard",
    description: "Een paar dashboardvragen, daarna bouwt de AI een PoC-dashboard voor dit probleem.",
    from: "proposal_finalized",
    doneAt: "dashboard_generated",
    substeps: [
      { key: "dashboardvragen", label: "Dashboardvragen", route: "dashboard-questions", from: "proposal_finalized", doneAt: "questions2_answered" },
      { key: "dashboard", label: "Dashboard", route: "dashboard", from: "questions2_answered", doneAt: "dashboard_generated" },
    ],
  },
  {
    key: "versturen",
    number: 4,
    label: "Versturen",
    description: "Bijlagen en begeleidende e-mail klaarzetten en als verzonden markeren.",
    from: "dashboard_generated",
    doneAt: "sent",
    substeps: [
      { key: "bijlagen", label: "Bijlagen & e-mail", route: "send", from: "dashboard_generated", doneAt: "sent" },
      { key: "verzonden", label: "Verzonden", route: "send", from: "sent", doneAt: "sent" },
    ],
  },
];

export type StepStatus = "done" | "active" | "future";

export function getStepStatus(item: { from: LeadState; doneAt: LeadState }, state: LeadState): StepStatus {
  if (isStateAtLeast(state, item.doneAt)) return "done";
  if (isStateAtLeast(state, item.from)) return "active";
  return "future";
}

/** The step a page segment (e.g. "dashboard-questions") belongs to, or null (e.g. print). */
export function getStepForRoute(segment: string | undefined): Step | null {
  if (!segment) return null;
  return STEPS.find((s) => s.substeps.some((sub) => sub.route === segment)) ?? null;
}

/** The substep being viewed: the last reached substep that lives on this page. */
export function getViewedSubstep(step: Step, segment: string, state: LeadState): Substep {
  const onPage = step.substeps.filter((s) => s.route === segment);
  const reached = onPage.filter((s) => isStateAtLeast(state, s.from));
  return reached[reached.length - 1] ?? onPage[0] ?? step.substeps[0];
}

/** Where clicking a reached step goes: the page of its furthest reached substep. */
export function getStepHref(leadId: string, step: Step, state: LeadState): string {
  const reached = step.substeps.filter((s) => isStateAtLeast(state, s.from));
  const target = reached[reached.length - 1] ?? step.substeps[0];
  return `/leads/${leadId}/${target.route}`;
}

/** Short "where is this lead" label for the lead list, e.g. "Voorstel · Bewerken & feedback". */
export function describeStatus(state: LeadState): string {
  const step = STEPS.find((s) => getStepStatus(s, state) === "active");
  if (!step) return "Verzonden";
  const sub = step.substeps.find((s) => getStepStatus(s, state) === "active") ?? step.substeps[0];
  return `${step.label} · ${sub.label}`;
}

export class WorkflowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkflowError";
  }
}

type Action =
  | "generateQuestions1"
  | "submitAnswers1"
  | "generateProposal"
  | "editProposal"
  | "finalizeProposal"
  | "reopenProposal"
  | "generateQuestions2"
  | "submitAnswers2"
  | "generateDashboard"
  | "markSent";

const TRANSITIONS: Record<Action, { from: LeadState[]; to: LeadState }> = {
  generateQuestions1: { from: ["transcript_uploaded"], to: "questions1_generated" },
  // Allowed from any state at or after questions1_generated, not just exactly that state or
  // questions1_answered — this is a human feedback loop (per the user), so answers must stay
  // editable even after the proposal/dashboard already exist. Resubmitting rewinds the lead
  // back to questions1_answered, same rewind-on-edit pattern as reopenProposal below; the
  // now-stale proposal/dashboard files stay on disk but the lead no longer claims to be past
  // them until the user regenerates.
  submitAnswers1: {
    from: [
      "questions1_generated",
      "questions1_answered",
      "proposal_generated",
      "proposal_finalized",
      "questions2_generated",
      "questions2_answered",
      "dashboard_generated",
      "sent",
    ],
    to: "questions1_answered",
  },
  generateProposal: {
    from: ["questions1_answered", "proposal_generated"],
    to: "proposal_generated",
  },
  // A manual save is a new version but not a new state: the route only asserts this (no
  // transitionLead), so stateHistory doesn't fill up with proposal_generated self-loops.
  editProposal: { from: ["proposal_generated"], to: "proposal_generated" },
  finalizeProposal: { from: ["proposal_generated"], to: "proposal_finalized" },
  // Allowed from any state at or after proposal_finalized, not just exactly that state —
  // otherwise a proposal can never be fixed once the dashboard steps have started.
  reopenProposal: {
    from: [
      "proposal_finalized",
      "questions2_generated",
      "questions2_answered",
      "dashboard_generated",
      "sent",
    ],
    to: "proposal_generated",
  },
  generateQuestions2: { from: ["proposal_finalized"], to: "questions2_generated" },
  // Same reasoning as submitAnswers1 above — stays editable even after the dashboard exists.
  submitAnswers2: {
    from: ["questions2_generated", "questions2_answered", "dashboard_generated", "sent"],
    to: "questions2_answered",
  },
  generateDashboard: {
    from: ["questions2_answered", "dashboard_generated", "sent"],
    to: "dashboard_generated",
  },
  // The one manual, never-auto-triggered action: a human attesting they actually sent the
  // proposal + dashboard to the client (the app has no way to observe that itself).
  markSent: { from: ["dashboard_generated"], to: "sent" },
};

/** True if `current` is at or past `min` in the workflow sequence — used to guard pages that
 * assume earlier steps' data already exists on disk (e.g. a directly-typed URL for a later step). */
export function isStateAtLeast(current: LeadState, min: LeadState): boolean {
  return STATE_ORDER.indexOf(current) >= STATE_ORDER.indexOf(min);
}

export function assertTransition(current: LeadState, action: Action): LeadState {
  const transition = TRANSITIONS[action];
  if (!transition.from.includes(current)) {
    throw new WorkflowError(
      `Actie '${action}' kan niet vanuit status '${current}'. Verwacht een van: ${transition.from.join(", ")}.`,
    );
  }
  return transition.to;
}
