# To Do

## Verified working (Node.js is installed, app has actually been run)
- [x] Node.js v24.19.0 + npm installed. `npm install` and `npm run build` both succeed cleanly (zero TypeScript errors across everything written this session).
- [x] Home page, proposal page, and live dashboard page all confirmed rendering correctly via real browser screenshots — huisstijl, Power BI visualstijl, charts, and colors all match what was designed.
- [x] New-lead upload flow confirmed working end-to-end (real multipart upload → `.txt` parsing → lead creation).
- [x] **"Interactieve HTML" dashboard export** — new button next to "Printweergave / PDF" on the dashboard page. Downloads a single, fully self-contained HTML file (~50KB, no server/library/CDN dependency) with a **real, working** Regio / Sales rep / Periode filter bar that live-recomputes the KPI tiles and both charts from the embedded `lib/sampleData` dataset (hand-drawn SVG charts, no recharts). Verified with an actual scripted browser interaction test: filtering to one region correctly dropped totals from €2.157.470/434 transactions to €346.580/74, and "reset" restored the exact original numbers. `lib/sampleData/firms.json` gained `region`/`salesRep` fields for this (via `generate.py`, `transactions.json` unchanged).
  - Note: for the hand-authored Van Dijk Techniek demo lead specifically, the export's narrative text (about its own pipeline/deals story) won't numerically match the generic sample-data KPIs shown next to it — expected, since that demo's story was written independently of `lib/sampleData`. For any AI-generated lead going forward this won't happen, since the AI already writes its narrative knowing it's grounded in that same dataset.

## Operational gotcha (hit this once already)
- **Never run `npm run build` while `npm run dev` is running.** Both write to the same `.next` folder; running them at the same time corrupts it (missing-module errors, pages silently losing their CSS/JS). If the dev server ever starts serving an unstyled or broken page, stop it, delete `.next`, and restart `npm run dev` fresh — that's the fix, confirmed working.

## Blocking / needs a decision
- [ ] **Qwen3 is too slow to actually use right now, and it's not a quick fix.** Tested live: `think: false` and Qwen's own `/no_think` directive were both tried against this Ollama setup — neither actually suppresses reasoning (a trivial one-line prompt still took 10+ minutes; `/no_think` just moved the reasoning into a separate `reasoning` response field instead of skipping it). Real proposal/dashboard prompts (much bigger) haven't been fully tested to completion. Options to consider: a different/smaller local model, accepting the slowness for non-time-sensitive use, or defaulting to DeepSeek and treating local-only as experimental for now.

## Files still needed from you
- [ ] **One finished, sent proposal** (not discovery notes — an actual document a client received): save as `brand/voorbeeld-voorstel.docx` (or `.pdf`/`.txt`), or paste the text in chat. Still the one piece missing to match tone/phrasing/structure — it'll also get added to the growing example library (`brand/examples/`) once you do.

## Optional follow-ups (not done, only worth it if you want them)
- [ ] Left-sidebar slicer layout (top-bar was built instead), functional filter pills on the *live* dashboard page (only the new export has real filtering — the in-app page still has decorative pills, deliberately out of scope for that feature), and the "Doelstellingen" scorecard table (realized/budget/%/pass-fail) from your dashboard example — all real feature additions, none built.
- [ ] Git init + first commit — offered, you said not yet. No version history/backup exists for this project until this happens.

# Things to think about

- **Client data going to DeepSeek**: when using DeepSeek (vs. the local Qwen3 option), sales call transcripts get sent to a third-party API for every generation step. Worth a conscious call on whether that's acceptable for client data, or whether local-only should be the default going forward — though see the Qwen3 speed problem above first.
- **Real MP4 upload**: still out of scope — only pre-transcribed files are accepted. Gemma 4 E4B (Google, ~4.5B effective params) is a real local-only path for this (native audio input for speech recognition), but Ollama's `gemma4:e4b` audio transcription currently has an [open bug](https://github.com/ollama/ollama/issues/16584) producing hallucinated output; `llama-server` reportedly handles it more reliably. Would be new feature work, not a config change.
- **Real pricing in proposals**: the "investment" section is deliberately a placeholder — the AI never invents numbers. Decide if/how real pricing should eventually get in (manual edit step? a pricing sheet the AI references?).
- **Sample dataset shape mismatch**: `lib/sampleData/` (used to ground dashboard numbers, and now the interactive export) is generic sales/revenue data. Fits a pipeline-style engagement well, but won't fit inventory, HR, or production-tracking engagements — worth deciding whether to add another dataset shape for those.
- **No backup for `data/`**: leads/transcripts/proposals live only as local files, gitignored, single machine. Fine for a prototype — worth a decision before this holds real client data long-term.
- **Manual editing of generated proposal text**: the only way to change a proposal is AI feedback + regenerate — no direct text editing yet.
- **Multi-user / shared use**: currently single-user, no auth, local-only by design. A real architecture change if that ever needs to expand.
