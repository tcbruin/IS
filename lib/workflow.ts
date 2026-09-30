import { LEAD_STATES, type LeadState } from "./validation";
import type { StepKey } from "./telemetryEvents";
import { pick, type Locale } from "./i18n";

export type { StepKey };

export const STATE_ORDER = LEAD_STATES;

export const STATE_LABELS: Record<LeadState, string> = {
  transcript_uploaded: "Transcript uploaded",
  questions1_generated: "Clarifying questions ready",
  questions1_answered: "Answers received",
  proposal_generated: "Proposal in review",
  proposal_finalized: "Proposal final",
  questions2_generated: "Dashboard questions ready",
  questions2_answered: "Dashboard answers received",
  dashboard_generated: "Dashboard ready",
  sent: "Sent",
};

/** Which page a state's work continues on — the `/leads/[id]` redirect target ("continue where you
 * left off"). Always the page of the step the lead is active in, matching the step bar. */
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
    key: "call",
    number: 1,
    label: "Call",
    description: "Transcript and notes; the AI asks clarifying questions that you answer.",
    from: "transcript_uploaded",
    doneAt: "questions1_answered",
    substeps: [
      { key: "transcript", label: "Transcript & notes", route: "questions", from: "transcript_uploaded", doneAt: "questions1_generated" },
      { key: "questions", label: "Answer questions", route: "questions", from: "questions1_generated", doneAt: "questions1_answered" },
    ],
  },
  {
    key: "proposal",
    number: 2,
    label: "Proposal",
    description: "The AI writes a draft; you edit it, request changes and finalize it.",
    from: "questions1_answered",
    doneAt: "proposal_finalized",
    substeps: [
      { key: "draft", label: "Draft", route: "proposal", from: "questions1_answered", doneAt: "proposal_generated" },
      { key: "edit", label: "Edit & feedback", route: "proposal", from: "proposal_generated", doneAt: "proposal_finalized" },
      { key: "final", label: "Final", route: "proposal", from: "proposal_finalized", doneAt: "proposal_finalized" },
    ],
  },
  {
    key: "dashboard",
    number: 3,
    label: "Dashboard",
    description: "A few dashboard questions, then the AI builds a PoC dashboard for this problem.",
    from: "proposal_finalized",
    doneAt: "dashboard_generated",
    substeps: [
      { key: "dashboard-questions", label: "Dashboard questions", route: "dashboard-questions", from: "proposal_finalized", doneAt: "questions2_answered" },
      { key: "dashboard", label: "Dashboard", route: "dashboard", from: "questions2_answered", doneAt: "dashboard_generated" },
    ],
  },
  {
    key: "send",
    number: 4,
    label: "Send",
    description: "Prepare the attachments and cover email, then mark as sent.",
    from: "dashboard_generated",
    doneAt: "sent",
    substeps: [
      { key: "attachments", label: "Attachments & email", route: "send", from: "dashboard_generated", doneAt: "sent" },
      { key: "sent", label: "Sent", route: "send", from: "sent", doneAt: "sent" },
    ],
  },
];

const DUTCH_STEP_COPY: Record<StepKey, { label: string; description: string; substeps: Record<string, string> }> = {
  call: {
    label: "Gesprek",
    description: "Transcript en notities; de AI stelt verduidelijkende vragen die jij beantwoordt.",
    substeps: { transcript: "Transcript & notities", questions: "Vragen beantwoorden" },
  },
  proposal: {
    label: "Voorstel",
    description: "De AI schrijft een concept; jij bewerkt het, vraagt wijzigingen aan en maakt het definitief.",
    substeps: { draft: "Concept", edit: "Bewerken & feedback", final: "Definitief" },
  },
  dashboard: {
    label: "Dashboard",
    description: "Na enkele vragen bouwt de AI een PoC-dashboard voor dit vraagstuk.",
    substeps: { "dashboard-questions": "Dashboardvragen", dashboard: "Dashboard" },
  },
  send: {
    label: "Versturen",
    description: "Bereid de bijlagen en begeleidende e-mail voor en markeer daarna als verzonden.",
    substeps: { attachments: "Bijlagen & e-mail", sent: "Verzonden" },
  },
};

export function getSteps(locale: Locale = "en"): Step[] {
  if (locale === "en") return STEPS;
  return STEPS.map((step) => ({
    ...step,
    label: DUTCH_STEP_COPY[step.key].label,
    description: DUTCH_STEP_COPY[step.key].description,
    substeps: step.substeps.map((sub) => ({ ...sub, label: DUTCH_STEP_COPY[step.key].substeps[sub.key] ?? sub.label })),
  }));
}

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

/** Short "where is this lead" label for the lead list, e.g. "Proposal · Edit & feedback". */
export function describeStatus(state: LeadState, locale: Locale = "en"): string {
  const step = getSteps(locale).find((s) => getStepStatus(s, state) === "active");
  if (!step) return pick(locale, "Sent", "Verzonden");
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
      `Action '${action}' is not allowed from state '${current}'. Expected one of: ${transition.from.join(", ")}.`,
    );
  }
  return transition.to;
}
