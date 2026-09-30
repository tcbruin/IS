# DataVance demo

A local Next.js demo that turns a sales-call transcript into a consultant-reviewed proposal, an illustrative dashboard, and a draft cover email.

## Run it

1. Install a recent Node.js version and run `npm ci`.
2. Run `npm run dev` and open the local URL shown in the terminal (usually `http://localhost:3000`).
3. Open **Demo** and choose **Start (fast)** for a recorded scenario. Fast replay does not need an AI API key.

For live AI, copy `.env.example` to `.env.local`, add your `LLM_API_KEY`, then restart the server. You can also create a new lead and upload a `.txt`, `.docx`, `.srt`, or `.vtt` transcript with optional consultant notes.

Follow **Call → Proposal → Dashboard → Send**. Answer the AI's questions, review/edit the proposal, inspect the sample-data dashboard, then download the files and copy the email into your mail client. The app does **not** transcribe audio or send email itself. You can switch the interface between English and Dutch.

Lead data is stored locally in `data/` and is not committed to Git. Use approved/anonymized material for demos. Stop the server with `Ctrl+C`; do not run `npm run build` while the dev server is running because both use `.next`.
