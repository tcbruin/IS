import { promises as fs } from "fs";
import path from "path";
import { z } from "zod";
import { DATA_ROOT } from "./paths";

/** App-wide evaluation assumptions, editable on /evaluation. Every field has a default so a
 * missing or older settings file always parses. */
export const settingsSchema = z.object({
  /** Manual baseline: how long one lead (proposal + PoC dashboard + email) takes without the app. */
  baselineMinutesPerLead: z.number().positive().default(240),
  baselineSource: z.string().default("Assumption — still to be validated with colleagues"),
  hourlyRateEur: z.number().positive().default(95),
  usdToEur: z.number().positive().default(0.86),
  /** Artificial wait before a recorded demo answer is returned, so replay still feels like AI. */
  replayDelayMs: z.number().int().min(0).max(10000).default(1500),
});
export type Settings = z.infer<typeof settingsSchema>;

const SETTINGS_FILE = path.join(DATA_ROOT, "settings.json");

export async function getSettings(): Promise<Settings> {
  try {
    return settingsSchema.parse(JSON.parse(await fs.readFile(SETTINGS_FILE, "utf-8")));
  } catch {
    return settingsSchema.parse({});
  }
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = settingsSchema.parse({ ...(await getSettings()), ...patch });
  await fs.mkdir(DATA_ROOT, { recursive: true });
  const tmp = `${SETTINGS_FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(next, null, 2), "utf-8");
  await fs.rename(tmp, SETTINGS_FILE);
  return next;
}
