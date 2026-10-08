const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const ts = require("typescript");

// Exercise the actual TypeScript helpers without adding a runtime dependency.
require.extensions[".ts"] = (module, filename) => module._compile(
  ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, filename,
);
const { compactProposalFallback, proposalCompactnessIssues } = require("../lib/proposalCompactness.ts");
const { proposalContentSchema } = require("../lib/validation.ts");
const { countWords } = require("../lib/proposalDocument.ts");
const { getProposalSections } = require("../lib/proposalSections.ts");

test("four-block layout retains every editing key with only three headings below the opening", () => {
  for (const locale of ["en", "nl"]) {
    const sections = getProposalSections(locale);
    assert.equal(sections.length, 7);
    assert.deepEqual(sections.filter((s) => s.heading).map((s) => s.key), ["approach", "timeline", "nextSteps"]);
    assert(sections.every((s) => s.label));
  }
});

test("fallback preserves valid drafts and all commitments even when the model exceeds its budget", () => {
  for (const size of [1, 3, 20, 50, 191, 1000]) {
    const text = Array(size).fill("detail").join(" ");
    const content = {
      coverIntro: text, situation: text, approach: text, investment: text, nextSteps: text,
      goals: Array(8).fill(text), scopeDeliverables: Array(8).fill(text),
      timeline: { phases: Array(8).fill({ name: text, description: text }) },
    };
    const compact = compactProposalFallback(content);
    assert.equal(proposalContentSchema.safeParse(compact).success, true);
    assert.deepEqual(compact, content);
  }
});

test("fallback normalises line breaks without cutting sentences", () => {
  const content = JSON.parse(fs.readFileSync("demo/recordings/kramer/proposal-1.json"));
  content.approach = Array(100).fill("detail").join("\n\n");
  const compact = compactProposalFallback(content);
  assert.equal(compact.approach, Array(100).fill("detail").join(" "));
  assert(!compact.approach.includes("\n"));
  assert(!compact.approach.includes("…"));
});

test("all replay proposals satisfy the hard length limits", () => {
  for (const scenario of ["kramer", "van-dijk", "verkerk"]) {
    for (const version of [1, 2]) {
      const content = JSON.parse(fs.readFileSync(`demo/recordings/${scenario}/proposal-${version}.json`));
      assert.deepEqual(proposalCompactnessIssues(content), []);
      assert(countWords(content) >= 350 && countWords(content) <= 400);
    }
  }
});

test("Word export uses grouped headings and retains proposal text in both languages", async () => {
  const { buildProposalDocx } = require("../lib/proposalDocx.ts");
  const mammoth = require("mammoth");
  const content = JSON.parse(fs.readFileSync("demo/recordings/kramer/proposal-1.json"));
  for (const locale of ["en", "nl"]) {
    const buffer = await buildProposalDocx({
      content, locale, companyName: "Kramer Bouwservice", dateLabel: "2 October 2026", versionNumber: 1,
      logoPng: fs.readFileSync("public/logo.png"),
      fonts: { body: fs.readFileSync("brand/fonts/Manrope-Regular.ttf"), heading: fs.readFileSync("brand/fonts/Epilogue-SemiBold.ttf") },
    });
    const result = await mammoth.convertToHtml({ buffer });
    for (const section of getProposalSections(locale).filter((s) => s.heading)) {
      assert(result.value.includes(section.heading.replace(/&/g, "&amp;")));
    }
    const text = (await mammoth.extractRawText({ buffer })).value;
    assert(text.includes(content.coverIntro));
    assert(text.includes(content.approach));
    assert(text.includes(content.nextSteps));
    assert(!result.value.includes("<h1>Goals</h1>"));
  }
});
