"use client";

import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { getStepForRoute } from "@/lib/workflow";
import { FAILURE_CATEGORIES, STEP_KEYS, type StepKey } from "@/lib/telemetryEvents";
import { PROPOSAL_SECTIONS } from "@/lib/proposalSections";
import { track } from "./track";
import styles from "./ReportIssueButton.module.css";

const STEP_LABELS: Record<StepKey, string> = {
  call: "Call & questions",
  proposal: "Proposal",
  dashboard: "Dashboard",
  send: "Send",
};

/** Quiet "Report an issue" in the lead header: logs what went wrong for the failure analysis.
 * Native <dialog>, the step is pre-filled from the page you're on. */
export function ReportIssueButton({ leadId }: { leadId: string }) {
  const pathname = usePathname();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState<StepKey>("call");
  const [category, setCategory] = useState<(typeof FAILURE_CATEGORIES)[number] | null>(null);
  const [severity, setSeverity] = useState<"minor" | "major">("minor");
  const [section, setSection] = useState("");
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);

  function open() {
    setStep(getStepForRoute(pathname.split("/")[3])?.key ?? "call");
    setCategory(null);
    setSeverity("minor");
    setSection("");
    setNote("");
    setSent(false);
    dialogRef.current?.showModal();
  }

  async function submit() {
    if (!category) return;
    await track(leadId, {
      type: "failure_report",
      step,
      category,
      severity,
      ...(section ? { section } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
    });
    setSent(true);
    window.setTimeout(() => dialogRef.current?.close(), 900);
  }

  return (
    <>
      <button type="button" className={styles.trigger} onClick={open}>
        Report an issue
      </button>
      <dialog ref={dialogRef} className={styles.dialog} onClick={(e) => e.target === dialogRef.current && dialogRef.current?.close()}>
        {sent ? (
          <p className={styles.thanks}>✓ Logged — thank you. This counts toward the failure analysis.</p>
        ) : (
          <div className={styles.body}>
            <h3 className={styles.title}>Report an issue</h3>

            <label className={styles.field}>
              <span>Step</span>
              <select value={step} onChange={(e) => setStep(e.target.value as StepKey)}>
                {STEP_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {STEP_LABELS[k]}
                  </option>
                ))}
              </select>
            </label>

            <div className={styles.field}>
              <span>What went wrong?</span>
              <div className={styles.chips}>
                {FAILURE_CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={[styles.chip, category === c ? styles.chipOn : ""].join(" ")}
                    onClick={() => setCategory(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.field}>
              <span>Severity</span>
              <div className={styles.chips}>
                {(["minor", "major"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={[styles.chip, severity === s ? styles.chipOn : ""].join(" ")}
                    onClick={() => setSeverity(s)}
                  >
                    {s === "minor" ? "Minor — quick fix" : "Major — not usable"}
                  </button>
                ))}
              </div>
            </div>

            {step === "proposal" && (
              <label className={styles.field}>
                <span>Section (optional)</span>
                <select value={section} onChange={(e) => setSection(e.target.value)}>
                  <option value="">—</option>
                  {PROPOSAL_SECTIONS.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className={styles.field}>
              <span>Details (optional)</span>
              <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What was wrong?" />
            </label>

            <div className={styles.actions}>
              <button type="button" className={styles.cancel} onClick={() => dialogRef.current?.close()}>
                Cancel
              </button>
              <button type="button" className={styles.submit} onClick={() => void submit()} disabled={!category}>
                Log issue
              </button>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
