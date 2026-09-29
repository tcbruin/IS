/**
 * Datavance's sales/discovery methodology, injected into every AI call so proposal and
 * dashboard generation actually reflect how Datavance sells — not generic consultant output.
 * Edit this file to tune AI behavior; no other prompt file should need to change for that.
 */
export const DATAVANCE_PLAYBOOK = `
Datavance sales and discovery approach (guiding for every step):

- Since the strategy change, Datavance scopes ONE specific problem per proposal at a fixed price — no longer a broad approach covering several problems at once. If the transcript or notes mention several problems, choose the most concrete and urgent one as the scope. Mention the rest at most briefly as a possible next step, not as part of this proposal.
- Avoid container terms like "more insight" or "better control" as a problem or outcome. Force sharpness: a concrete, measurable problem and a concrete, measurable result.
- Discovery dimensions for spotting gaps:
  1. Problem: which process costs time/frustration now, how is it done today (Excel/manual/separate systems), how often, what goes wrong.
  2. Desired outcome: what do they want to see/decide that they can't now, when is this a success.
  3. User & context: who uses the result, at what level (operational/tactical/management).
  4. KPIs & metrics: which figures matter.
  5. Data & systems: which systems hold the data, is there an export or API.
  6. Current way of working: how much time/how many people it takes now to get this insight — this proves the time savings.
- Name concrete system names from the transcript/notes (e.g. Twinfield, Exact, Ridder, Nitea) instead of vague terms like "your systems".
`.trim();
