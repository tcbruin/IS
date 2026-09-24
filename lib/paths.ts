import path from "path";

/** Root of all file-based persistence. Shared by leadStore and telemetry so the two never
 * disagree on where a lead's folder lives. */
export const DATA_ROOT = path.join(process.cwd(), "data");
export const LEADS_DIR = path.join(DATA_ROOT, "leads");

export function leadDir(leadId: string): string {
  return path.join(LEADS_DIR, leadId);
}
