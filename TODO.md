# To Do

## Verified working (Node.js is installed, app has actually been run)
- [x] Node.js v24.19.0 + npm installed. `npm install` and `npm run build` both succeed cleanly (zero TypeScript errors across everything written this session).
- [x] Home page, proposal page, and live dashboard page all confirmed rendering correctly via real browser screenshots — huisstijl, Power BI visualstijl, charts, and colors all match what was designed.
- [x] New-lead upload flow confirmed working end-to-end (real multipart upload → `.txt` parsing → lead creation).
- [x] **"Interactieve HTML" dashboard export** — a single, fully offline HTML file with working filters. Since 24 Sep 2026 it inlines the same engine (`lib/dashboardEngine.js`) and stylesheet (`components/dashboard/canvas.css`) as the live page, so the numbers always match. The old generic `lib/sampleData` dataset is gone: every dashboard now has its own AI-designed data model with illustrative data (see `brand/visualstijl-powerbi.md`).

## Operational gotcha (hit this once already)
- **Never run `npm run build` while `npm run dev` is running.** Both write to the same `.next` folder; running them at the same time corrupts it (missing-module errors, pages silently losing their CSS/JS). If the dev server ever starts serving an unstyled or broken page, stop it, delete `.next`, and restart `npm run dev` fresh — that's the fix, confirmed working.
- **OneDrive can lock `.next`** (the project lives in a synced folder): API routes suddenly return 500 with `EBUSY: resource busy or locked` in the dev log. Same fix: stop the dev server, delete `.next`, restart. Pausing OneDrive sync for this folder (or excluding `.next`) prevents it.

## Before using numbers in the school report
- [ ] **Verify DeepSeek prices** at https://api-docs.deepseek.com/quick_start/pricing, update `lib/llmPricing.ts` and set `PRICING_VERIFIED_ON`. `/evaluatie` shows a warning until then.
- [ ] **Validate the manual baseline** (default 240 min per lead) with colleagues and fill in its source on `/evaluatie` → Aannames. The Terugblik card also collects per-lead estimates as a sensitivity check.
- [ ] Test leads created before 24 Sep 2026 have no `lead_created` event and are therefore not counted — by design, since half their history is missing.

## Please check once by hand
- [ ] **Open a downloaded proposal `.docx` in desktop Word** on a machine without Manrope/Epilogue installed: the fonts are embedded (`brand/fonts/`), headers/footers and "Pagina X van Y" should show. If fonts look wrong, switch `FONTS` in `lib/proposalLayout.ts` to Arial. Note: Word only keeps embedded fonts on re-save if "Lettertypen insluiten" is enabled.

## Blocking / needs a decision
- [ ] **Qwen3 is too slow to actually use right now, and it's not a quick fix.** Tested live: `think: false` and Qwen's own `/no_think` directive were both tried against this Ollama setup — neither actually suppresses reasoning (a trivial one-line prompt still took 10+ minutes; `/no_think` just moved the reasoning into a separate `reasoning` response field instead of skipping it). Real proposal/dashboard prompts (much bigger) haven't been fully tested to completion. Options to consider: a different/smaller local model, accepting the slowness for non-time-sensitive use, or defaulting to DeepSeek and treating local-only as experimental for now.

## Files still needed from you
- [ ] **One finished, sent proposal** (not discovery notes — an actual document a client received): save as `brand/voorbeeld-voorstel.docx` (or `.pdf`/`.txt`), or paste the text in chat. Still the one piece missing to match tone/phrasing/structure — it'll also get added to the growing example library (`brand/examples/`) once you do.

## Optional follow-ups (not done, only worth it if you want them)
- [ ] Left-sidebar slicer layout (top-bar was built instead). Filters now work on the live page too (same engine as the export). Dashboard page patterns 2 and 3 from the reference (one big table / matrix) are not built yet — only `overview` and `openItems`.
- [ ] Git init + first commit — offered, you said not yet. No version history/backup exists for this project until this happens.

# Things to think about

- **Client data going to DeepSeek**: when using DeepSeek (vs. the local Qwen3 option), sales call transcripts get sent to a third-party API for every generation step — and the two most recent finalized proposals of *other* clients go along as examples in every proposal prompt (`brand/examples/`). Worth a conscious call on whether that's acceptable for client data, or whether local-only should be the default going forward. (Demo leads never enter the example library, and a lead never gets its own company's old proposal as an example.) Telemetry (`events.jsonl`) holds metadata only, no client text.
- **Real MP4 upload**: still out of scope — only pre-transcribed files are accepted. Gemma 4 E4B (Google, ~4.5B effective params) is a real local-only path for this (native audio input for speech recognition), but Ollama's `gemma4:e4b` audio transcription currently has an [open bug](https://github.com/ollama/ollama/issues/16584) producing hallucinated output; `llama-server` reportedly handles it more reliably. Would be new feature work, not a config change.
- **Real pricing in proposals**: the AI keeps the investment section a placeholder; a real price can now be typed in the Word-style editor (manual edits aren't flagged by the price guardrail). Note that a finalized proposal — including a typed price — goes into the example library.
- **No backup for `data/`**: leads/transcripts/proposals live only as local files, gitignored, single machine. Fine for a prototype — worth a decision before this holds real client data long-term.
- **Multi-user / shared use**: currently single-user, no auth, local-only by design. A real architecture change if that ever needs to expand.
