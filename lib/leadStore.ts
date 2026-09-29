import { promises as fs } from "fs";
import path from "path";
import { newId } from "./ids";
import { LEADS_DIR, leadDir } from "./paths";
import { logEvent } from "./telemetry";
import { assertTransition, WorkflowError } from "./workflow";
import {
  type Lead,
  type LeadState,
  type Question,
  type Answer,
  type ProposalContent,
  type ProposalVersion,
  type ProposalCurrent,
  type DashboardRecord,
  type CoverEmail,
  leadSchema,
  proposalVersionSchema,
  proposalCurrentSchema,
  dashboardRecordSchema,
  coverEmailSchema,
} from "./validation";

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

const DATA_DIR = LEADS_DIR;

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function writeJsonAtomic(filePath: string, data: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath));
  const tmpPath = `${filePath}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), "utf-8");
  await fs.rename(tmpPath, filePath);
}

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

// ---- Lead ----

export async function createLead(input: {
  companyName: string;
  leadName?: string;
  sourceSystem?: string;
  demo?: Lead["demo"];
}): Promise<Lead> {
  const id = newId();
  const now = new Date().toISOString();
  const lead: Lead = {
    id,
    companyName: input.companyName,
    leadName: input.leadName,
    sourceSystem: input.sourceSystem,
    demo: input.demo,
    state: "transcript_uploaded",
    stateHistory: [{ state: "transcript_uploaded", at: now }],
    createdAt: now,
    updatedAt: now,
  };
  await ensureDir(leadDir(id));
  await writeJsonAtomic(path.join(leadDir(id), "lead.json"), lead);
  return lead;
}

export async function getLead(leadId: string): Promise<Lead> {
  const data = await readJson<Lead>(path.join(leadDir(leadId), "lead.json"));
  if (!data) throw new NotFoundError(`Lead ${leadId} not found.`);
  return leadSchema.parse(data);
}

export async function listLeads(): Promise<Lead[]> {
  await ensureDir(DATA_DIR);
  const entries = await fs.readdir(DATA_DIR, { withFileTypes: true });
  const leads: Lead[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const data = await readJson<Lead>(path.join(DATA_DIR, entry.name, "lead.json"));
    if (data) leads.push(leadSchema.parse(data));
  }
  leads.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return leads;
}

export async function deleteLead(leadId: string): Promise<void> {
  await fs.rm(leadDir(leadId), { recursive: true, force: true });
}

/**
 * Validates the requested action against the lead's current state, then persists the new
 * state + history entry. Throws WorkflowError (caller maps this to HTTP 409) if out of order.
 */
export async function transitionLead(
  leadId: string,
  action: Parameters<typeof assertTransition>[1],
): Promise<Lead> {
  const lead = await getLead(leadId);
  const nextState = assertTransition(lead.state, action);
  const now = new Date().toISOString();
  const updated: Lead = {
    ...lead,
    state: nextState,
    stateHistory: [...lead.stateHistory, { state: nextState, at: now }],
    updatedAt: now,
  };
  await writeJsonAtomic(path.join(leadDir(leadId), "lead.json"), updated);
  await logEvent(leadId, { type: "state_changed", from: lead.state, to: nextState });
  return updated;
}

export { WorkflowError };

// ---- Transcript ----

export async function writeTranscriptRaw(
  leadId: string,
  ext: string,
  buffer: Buffer,
): Promise<void> {
  await ensureDir(leadDir(leadId));
  await fs.writeFile(path.join(leadDir(leadId), `transcript.raw${ext}`), buffer);
}

export async function writeTranscriptText(leadId: string, text: string): Promise<void> {
  await ensureDir(leadDir(leadId));
  await fs.writeFile(path.join(leadDir(leadId), "transcript.txt"), text, "utf-8");
}

export async function getTranscriptText(leadId: string): Promise<string> {
  const filePath = path.join(leadDir(leadId), "transcript.txt");
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new NotFoundError(`Transcript for lead ${leadId} not found.`);
    }
    throw err;
  }
}

// ---- Consultant notes (optional, supplements the transcript) ----

export async function writeConsultantNotes(leadId: string, notes: string): Promise<void> {
  await ensureDir(leadDir(leadId));
  await fs.writeFile(path.join(leadDir(leadId), "notes.txt"), notes, "utf-8");
}

export async function getConsultantNotes(leadId: string): Promise<string | null> {
  try {
    const notes = await fs.readFile(path.join(leadDir(leadId), "notes.txt"), "utf-8");
    return notes.trim() || null;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

// ---- Questions & answers (shared shape for round 1 and round 2) ----

type Round = 1 | 2;

function questionsFile(leadId: string, round: Round): string {
  return path.join(leadDir(leadId), `questions-${round}.json`);
}

function answersFile(leadId: string, round: Round): string {
  return path.join(leadDir(leadId), `answers-${round}.json`);
}

export async function writeQuestions(
  leadId: string,
  round: Round,
  questions: Question[],
): Promise<void> {
  await writeJsonAtomic(questionsFile(leadId, round), { questions });
}

export async function getQuestions(leadId: string, round: Round): Promise<Question[]> {
  const data = await readJson<{ questions: Question[] }>(questionsFile(leadId, round));
  if (!data) throw new NotFoundError(`Questions (round ${round}) for lead ${leadId} not found.`);
  return data.questions;
}

export async function writeAnswers(
  leadId: string,
  round: Round,
  answers: Answer[],
): Promise<void> {
  await writeJsonAtomic(answersFile(leadId, round), { answers });
}

export async function getAnswers(leadId: string, round: Round): Promise<Answer[]> {
  const data = await readJson<{ answers: Answer[] }>(answersFile(leadId, round));
  if (!data) throw new NotFoundError(`Answers (round ${round}) for lead ${leadId} not found.`);
  return data.answers;
}

// ---- Proposal versions ----

function proposalDir(leadId: string): string {
  return path.join(leadDir(leadId), "proposal");
}

function proposalVersionsDir(leadId: string): string {
  return path.join(proposalDir(leadId), "versions");
}

function proposalCurrentFile(leadId: string): string {
  return path.join(proposalDir(leadId), "current.json");
}

export async function getProposalCurrent(leadId: string): Promise<ProposalCurrent> {
  const data = await readJson<ProposalCurrent>(proposalCurrentFile(leadId));
  if (!data) return { latestVersion: 0, finalVersion: null };
  return proposalCurrentSchema.parse(data);
}

export async function getProposalVersion(
  leadId: string,
  version: number,
): Promise<ProposalVersion> {
  const data = await readJson<ProposalVersion>(
    path.join(proposalVersionsDir(leadId), `v${version}.json`),
  );
  if (!data) throw new NotFoundError(`Proposal version v${version} not found.`);
  return proposalVersionSchema.parse(data);
}

export async function getLatestProposalVersion(leadId: string): Promise<ProposalVersion | null> {
  const current = await getProposalCurrent(leadId);
  if (current.latestVersion === 0) return null;
  return getProposalVersion(leadId, current.latestVersion);
}

export async function getFinalProposalVersion(leadId: string): Promise<ProposalVersion> {
  const current = await getProposalCurrent(leadId);
  if (!current.finalVersion) {
    throw new NotFoundError(`The proposal for lead ${leadId} has not been finalized yet.`);
  }
  return getProposalVersion(leadId, current.finalVersion);
}

export async function listProposalVersions(leadId: string): Promise<ProposalVersion[]> {
  const dir = proposalVersionsDir(leadId);
  if (!(await pathExists(dir))) return [];
  const entries = await fs.readdir(dir);
  const versions = await Promise.all(
    entries
      .filter((f) => f.endsWith(".json"))
      .map(async (f) => {
        const data = await readJson<ProposalVersion>(path.join(dir, f));
        return data ? proposalVersionSchema.parse(data) : null;
      }),
  );
  return versions
    .filter((v): v is ProposalVersion => v !== null)
    .sort((a, b) => a.version - b.version);
}

export async function appendProposalVersion(
  leadId: string,
  input: {
    content: ProposalContent;
    basedOnVersion: number | null;
    feedback: string | null;
    warnings?: string[];
    source?: ProposalVersion["source"];
    editStats?: ProposalVersion["editStats"];
  },
): Promise<ProposalVersion> {
  const current = await getProposalCurrent(leadId);
  const version = current.latestVersion + 1;
  const proposalVersion: ProposalVersion = {
    version,
    content: input.content,
    basedOnVersion: input.basedOnVersion,
    feedback: input.feedback,
    createdAt: new Date().toISOString(),
    warnings: input.warnings ?? [],
    source: input.source ?? "ai",
    ...(input.editStats ? { editStats: input.editStats } : {}),
  };
  await writeJsonAtomic(
    path.join(proposalVersionsDir(leadId), `v${version}.json`),
    proposalVersion,
  );
  const nextCurrent: ProposalCurrent = { ...current, latestVersion: version };
  await writeJsonAtomic(proposalCurrentFile(leadId), nextCurrent);
  return proposalVersion;
}

export async function finalizeProposalVersion(
  leadId: string,
  version: number,
): Promise<ProposalCurrent> {
  const current = await getProposalCurrent(leadId);
  if (version < 1 || version > current.latestVersion) {
    throw new NotFoundError(`Proposal version v${version} does not exist.`);
  }
  const nextCurrent: ProposalCurrent = { ...current, finalVersion: version };
  await writeJsonAtomic(proposalCurrentFile(leadId), nextCurrent);
  return nextCurrent;
}

export async function reopenProposal(leadId: string): Promise<ProposalCurrent> {
  const current = await getProposalCurrent(leadId);
  const nextCurrent: ProposalCurrent = { ...current, finalVersion: null };
  await writeJsonAtomic(proposalCurrentFile(leadId), nextCurrent);
  return nextCurrent;
}

// ---- Dashboard ----

function dashboardFile(leadId: string): string {
  return path.join(leadDir(leadId), "dashboard.json");
}

/** An old-format dashboard (relabelled generic sales data) — must be regenerated. Maps to 409. */
export class LegacyDashboardError extends WorkflowError {
  constructor() {
    super("This dashboard was created with an older version. Please regenerate it.");
    this.name = "LegacyDashboardError";
  }
}

export async function writeDashboard(leadId: string, record: DashboardRecord): Promise<void> {
  await writeJsonAtomic(dashboardFile(leadId), record);
}

export async function getDashboard(leadId: string): Promise<DashboardRecord> {
  const data = await readJson<{ version?: number }>(dashboardFile(leadId));
  if (!data) throw new NotFoundError(`Dashboard for lead ${leadId} not found.`);
  if (data.version !== 2) throw new LegacyDashboardError();
  return dashboardRecordSchema.parse(data);
}

// ---- Cover email (drafted once the dashboard exists, for the closing "send" step) ----

function coverEmailFile(leadId: string): string {
  return path.join(leadDir(leadId), "send-email.json");
}

export async function writeCoverEmail(leadId: string, email: CoverEmail): Promise<void> {
  await writeJsonAtomic(coverEmailFile(leadId), email);
}

export async function getCoverEmail(leadId: string): Promise<CoverEmail | null> {
  const data = await readJson<CoverEmail>(coverEmailFile(leadId));
  return data ? coverEmailSchema.parse(data) : null;
}

export type { LeadState };
