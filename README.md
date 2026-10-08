# DataVance demo

A local Next.js demo that turns a sales-call transcript into a consultant-reviewed proposal, an illustrative dashboard, and a draft cover email.

## Run it

1. Install a recent Node.js version and run `npm ci`.
2. Run `npm run dev` and open the local URL shown in the terminal (usually `http://localhost:3000`).
3. Open **Demo** and choose **Start (fast)** for a recorded scenario. Fast replay does not need an AI API key.

For live AI, copy `.env.example` to `.env.local`, add your `LLM_API_KEY`, then restart the server. You can also create a new lead and upload a `.txt`, `.docx`, `.srt`, or `.vtt` transcript with optional consultant notes.

Follow **Call → Proposal → Dashboard → Send**. Answer the AI's questions, review/edit the proposal, inspect the sample-data dashboard, then download the files and copy the email into your mail client. The app does **not** transcribe audio or send email itself. You can switch the interface between English and Dutch.

AI-written proposals open with an unlabeled **Situation → Complication → Question → Answer (SCQA)** narrative and target **350–400 words** when supported by the source material. Four visual blocks combine the opening/context/outcomes, approach/deliverables, planning/investment, and next step. The A4 layout uses 18 mm side margins, a 27 mm top margin, 10.5 pt body text and 1.2 line spacing across preview, PDF and Word. Automatic one-page fitting remains active during manual editing and after saving.

Generation tries up to three AI shortening passes. If these still exceed the recommended budget or a shortening call fails, the fallback preserves complete sentences and all items and returns a draft with a readability warning. It never cuts sentences or silently removes deliverables or phases.

The screen and browser print/PDF views measure every proposal, including manual edits, and reduce typography when necessary to fit one A4 page. Word export uses the document's standard typography, so Word's own pagination can differ.

Lead data is stored locally in `data/` and is not committed to Git. Use approved/anonymized material for demos. Stop the server with `Ctrl+C`; do not run `npm run build` while the dev server is running because both use `.next`.

## Evaluation

Open **Evaluation** and switch between **Demo** and **Actual results**. With no measured leads, the demo is selected automatically. Its six deterministic sample leads are illustrative; they are never saved into your lead list, never call an AI, and do not change your settings. Demo assumptions are fixed at 240 manual minutes per lead, €95/hour and USD→EUR 0.86. Actual assumptions remain editable. Replayed workflow demos are excluded from actual results; live demos can be included explicitly.

Time and cost comparisons use completed leads, or a clearly marked provisional cohort when none are completed. Consultant cost is active time × hourly rate; total app cost adds AI token cost per lead before taking the median. All-lead AI spend includes failed calls and shortening calls. Unknown model prices remain unavailable, with known spend shown as a subtotal; AI amounts use an explicitly labelled unverified price estimate rather than claiming to be invoiced charges.

Both CSV exports follow the selected mode, label illustrative data, and include cost assumptions and pricing completeness. Use `npm test` for calculation, export and proposal regression tests.
