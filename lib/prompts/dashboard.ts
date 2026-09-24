import type { Answer, ProposalContent, Question } from "../validation";
import { languageInstruction, jsonOnlyInstruction, formatQA, notesBlock, sourceSystemBlock } from "./shared";
import { DATAVANCE_PLAYBOOK } from "./playbook";

/** Logged with every call so evaluation can compare prompt iterations. Bump on meaningful edits.
 * v1-relabel: picked labels for a fixed generic sales dataset. v2-model: designs a data model. */
export const PROMPT_VERSION = "dashboard-v2-model";

const SPEC_SHAPE = `{
  "title": string,                       // page title in the client's words, no digits, no company name
  "layout": "overview" | "openItems",
  "model": {
    "entity": { "singular": string, "plural": string, "count": integer, "names": string[] /* up to 12 FICTIONAL names */, "sizeSpread": "even" | "skewed" },
    "dimensions": [ { "key": string, "label": string, "values": string[] /* 2-8 */ } ],   // 0-2
    "period": { "grain": "week" | "month", "count": integer /* weeks 12-26, months 12-24 */ },
    "measures": [ {                      // 1-4 base measures, generated per entity per period
      "key": string, "label": string, "unit": "euro" | "count" | "hours", "higherIsBetter": boolean,
      "typical": number,                 // value per entity per period for an average entity (omit when using relativeTo)
      "spread": "low" | "medium" | "high", "trend": "down" | "flat" | "up",
      "relativeTo": { "measure": string, "min": number, "max": number }   // optional: generate as min–max × an EARLIER base measure
    } ],
    "derived": [ {                       // 0-5, each may only use EARLIER measures
      "key": string, "label": string, "unit": "euro" | "count" | "hours" | "percent", "higherIsBetter": boolean,
      "op": "add" | "subtract" | "divide" | "multiply" | "balance", "a": string, "b": string /* add/subtract/divide */, "factor": number /* multiply */
    } ]
  },
  "anchors": [ { "kind": "count" | "level" | "threshold", "measure": string /* level/threshold */, "value": number, "quote": string } ],
  "kpis": [ { "measure": string, "label": string, "show": "value" | "flagCount", "flag": "threshold" | "vsAverage" | "vsPrevious" } ],
  "visuals": [
    { "type": "chart", "title": string, "x": "period" | "entity" | <dimension key>, "series": [ { "measure": string, "style": "bar" | "line", "running": boolean } ] },
    { "type": "table", "title": string, "rows": "entity" | <dimension key>, "columns": string[], "flag": { "measure": string, "rule": "threshold" | "vsAverage" | "vsPrevious" }, "sortBy": string, "sortDir": "desc" | "asc" }
  ],
  "filters": string[]                    // 1-2 of: "entity" or dimension keys
}`;

/** A worked example from a deliberately unrelated domain, so the model learns the shape without
 * copying the test clients. */
const EXAMPLE = `{
  "title": "Derving per filiaal",
  "layout": "overview",
  "model": {
    "entity": { "singular": "Filiaal", "plural": "Filialen", "count": 14, "names": ["Bakkerij Centrum", "Bakkerij Noord", "Bakkerij Station"], "sizeSpread": "skewed" },
    "dimensions": [ { "key": "regio", "label": "Regio", "values": ["Stad", "Randgemeenten"] } ],
    "period": { "grain": "week", "count": 16 },
    "measures": [
      { "key": "gebakken", "label": "Gebakken stuks", "unit": "count", "higherIsBetter": true, "typical": 2400, "spread": "medium", "trend": "flat" },
      { "key": "derving", "label": "Derving", "unit": "count", "higherIsBetter": false, "spread": "medium", "trend": "flat", "relativeTo": { "measure": "gebakken", "min": 0.04, "max": 0.14 } }
    ],
    "derived": [
      { "key": "derving_pct", "label": "Derving %", "unit": "percent", "higherIsBetter": false, "op": "divide", "a": "derving", "b": "gebakken" },
      { "key": "derving_eur", "label": "Dervingswaarde", "unit": "euro", "higherIsBetter": false, "op": "multiply", "a": "derving", "factor": 1.8 }
    ]
  },
  "anchors": [
    { "kind": "count", "value": 14, "quote": "we hebben veertien filialen" },
    { "kind": "threshold", "measure": "derving_pct", "value": 8, "quote": "alles boven de acht procent is echt te veel" }
  ],
  "kpis": [
    { "measure": "derving_eur", "label": "Dervingswaarde", "show": "value" },
    { "measure": "derving_pct", "label": "Derving %", "show": "value" },
    { "measure": "derving_pct", "label": "Filialen boven norm", "show": "flagCount", "flag": "threshold" }
  ],
  "visuals": [
    { "type": "chart", "title": "Gebakken en derving per week", "x": "period", "series": [ { "measure": "gebakken", "style": "bar" }, { "measure": "derving_pct", "style": "line" } ] },
    { "type": "table", "title": "Derving per filiaal", "rows": "entity", "columns": ["derving_pct", "derving_eur"], "flag": { "measure": "derving_pct", "rule": "threshold" }, "sortBy": "derving_pct", "sortDir": "desc" }
  ],
  "filters": ["regio", "entity"]
}`;

export function buildDashboardPrompt(input: {
  transcript: string;
  notes?: string;
  sourceSystem?: string;
  proposal: ProposalContent;
  questions: Question[];
  answers: Answer[];
}): { system: string; user: string } {
  const system = [
    "You are a senior consultant at Datavance designing a 1-page proof-of-concept (PoC) Power BI dashboard that shows the client what solving their ONE scoped problem looks like.",
    DATAVANCE_PLAYBOOK,
    "HOW IT WORKS: you design a small data model and the page. The app then generates illustrative sample rows from your model and computes every number on screen (the page is clearly labeled as illustrative sample data). You NEVER write a number that is displayed. The only numbers you write are generation settings (count, typical, relativeTo ranges, factor) and anchor values.",
    "MODEL: the entity is what the rows are about in the client's world (klant, project, chauffeur, filiaal…). Base measures are what gets counted or booked per entity per period; give a realistic 'typical' value per entity per period for an average entity. Use relativeTo for anything that is a fraction of another measure (costs of revenue, returns of deliveries, hours of capacity) — it keeps margins and balances realistic; your own arithmetic easily produces negative margins. Derived measures: subtract for a margin or net flow, divide with unit percent for a percentage, balance for a running stock (e.g. crates outstanding = balance of delivered − returned), multiply by a constant price for a value in euro (use a price stated in the call if there is one).",
    "TIME: pick the grain of the client's rhythm — weekly meetings or operations → week (12–26), financial reporting → month (12–24).",
    "ANCHORS: only numbers literally stated in the transcript, the consultant's notes or a concrete account-owner answer. 'quote' is the verbatim fragment (max ~12 words) containing the number, in the original words (digits or written out, e.g. \"vijftien procent\"). Never quote the questions or the proposal. count = number of entities; level = total of a measure across all entities in the latest period (for a balance: the balance now); threshold = a norm the client mentioned (percent values as e.g. 15, not 0.15). Anchors that cannot be found verbatim are discarded by the app.",
    "NORMS: never invent a norm. If no threshold was stated, flags use vsAverage (compared with the average) or vsPrevious (compared with the previous period).",
    "ESTIMATE ANSWERS: an answer like \"Geen concreet antwoord — schat dit zelf in…\" or \"Maak je eigen inschatting…\" delegates a design choice to you. It is never a source of numbers or anchors.",
    "PAGE: layout \"overview\" = up to 3 KPIs, then a wide chart plus a narrow table (or one wide visual). Layout \"openItems\" = up to 2 KPIs with a table below them on the left, and one or two visuals on the right. Charts: x = period for a trend, or entity/dimension for a comparison; 1–3 series with at most two units. Tables: rows = entity or a dimension, up to 4 measure columns, optional ✓/✗ flag column. KPIs answer the question the client actually asked; flagCount KPIs count entities failing a flag (e.g. \"Projecten onder norm\").",
    "LABELS: in the client's own Dutch words (fust, kratten, ploegbaas…), short, no digits, no company name (the header shows it). Keys: lowercase slugs like \"marge_pct\". Entity names: fictional, never real companies from the call.",
    languageInstruction(),
    jsonOnlyInstruction(),
    `JSON shape:\n${SPEC_SHAPE}`,
    `Example for an unrelated client (bakery chain with too much waste):\n${EXAMPLE}`,
  ].join("\n\n");

  const user = [
    `Transcript van het salesgesprek:\n\n${input.transcript}`,
    notesBlock(input.notes),
    sourceSystemBlock(input.sourceSystem),
    `Definitief voorstel (alleen voor de scope — geen bron voor ankers):\n\n${JSON.stringify(
      { situation: input.proposal.situation, goals: input.proposal.goals, scopeDeliverables: input.proposal.scopeDeliverables },
      null,
      2,
    )}`,
    `Antwoorden van de accountmanager op de dashboardvragen:\n\n${formatQA(input.questions, input.answers)}`,
  ]
    .filter(Boolean)
    .join("\n\n---\n\n");

  return { system, user };
}
