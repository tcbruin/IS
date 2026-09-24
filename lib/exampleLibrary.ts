import { promises as fs } from "fs";
import path from "path";
import { z } from "zod";
import { type ProposalContent, proposalContentSchema } from "./validation";

/**
 * Every finalized proposal gets saved here, so future proposal generation can draw on real,
 * approved examples instead of relying only on the static instructions in prompts/playbook.ts.
 * Quality compounds with use instead of staying frozen at whatever was hand-tuned once.
 */
const EXAMPLES_DIR = path.join(process.cwd(), "brand", "examples");

const proposalExampleSchema = z.object({
  companyName: z.string(),
  content: proposalContentSchema,
  savedAt: z.string(),
});
export type ProposalExample = z.infer<typeof proposalExampleSchema>;

async function ensureDir(): Promise<void> {
  await fs.mkdir(EXAMPLES_DIR, { recursive: true });
}

export async function saveProposalExample(input: {
  leadId: string;
  companyName: string;
  content: ProposalContent;
}): Promise<void> {
  await ensureDir();
  const example: ProposalExample = {
    companyName: input.companyName,
    content: input.content,
    savedAt: new Date().toISOString(),
  };
  const filePath = path.join(EXAMPLES_DIR, `${input.leadId}.json`);
  const tmpPath = `${filePath}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(example, null, 2), "utf-8");
  await fs.rename(tmpPath, filePath);
}

/** Most recently finalized proposals first, capped to `limit` to keep prompt size reasonable.
 * `excludeCompany` drops the lead's own earlier proposals — the prompt labels examples as
 * "other clients", so feeding a company its own old proposal would be mislabeled context. */
export async function getProposalExamples(
  limit = 2,
  excludeCompany?: string,
): Promise<ProposalExample[]> {
  await ensureDir();
  const files = (await fs.readdir(EXAMPLES_DIR)).filter((f) => f.endsWith(".json"));
  const examples = await Promise.all(
    files.map(async (file) => {
      try {
        const raw = await fs.readFile(path.join(EXAMPLES_DIR, file), "utf-8");
        return proposalExampleSchema.parse(JSON.parse(raw));
      } catch {
        return null;
      }
    }),
  );
  return examples
    .filter((e): e is ProposalExample => e !== null)
    .filter((e) => !excludeCompany || e.companyName.trim().toLowerCase() !== excludeCompany.trim().toLowerCase())
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
    .slice(0, limit);
}
