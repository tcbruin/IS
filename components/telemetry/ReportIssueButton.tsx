"use client";

import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { getStepForRoute } from "@/lib/workflow";
import { FAILURE_CATEGORIES, STEP_KEYS, type StepKey } from "@/lib/telemetryEvents";
import { PROPOSAL_SECTIONS } from "@/lib/proposalSections";
import { track } from "./track";
import styles from "./ReportIssueButton.module.css";

const STEP_LABELS: Record<StepKey, string> = {
  gesprek: "Gesprek & vragen",
  voorstel: "Voorstel",
  dashboard: "Dashboard",
  versturen: "Versturen",
};

/** Quiet "Meld een fout" in the lead header: logs what went wrong for the failure analysis.
 * Native <dialog>, the step is pre-filled from the page you're on. */
export function ReportIssueButton({ leadId }: { leadId: string }) {
  const pathname = usePathname();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState<StepKey>("gesprek");
  const [category, setCategory] = useState<(typeof FAILURE_CATEGORIES)[number] | null>(null);
  const [severity, setSeverity] = useState<"klein" | "groot">("klein");
  const [section, setSection] = useState("");
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);

  function open() {
    setStep(getStepForRoute(pathname.split("/")[3])?.key ?? "gesprek");
    setCategory(null);
    setSeverity("klein");
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
        Meld een fout
      </button>
      <dialog ref={dialogRef} className={styles.dialog} onClick={(e) => e.target === dialogRef.current && dialogRef.current?.close()}>
        {sent ? (
          <p className={styles.thanks}>✓ Vastgelegd — dank je. Dit telt mee in de foutenanalyse.</p>
        ) : (
          <div className={styles.body}>
            <h3 className={styles.title}>Meld een fout</h3>

            <label className={styles.field}>
              <span>Stap</span>
              <select value={step} onChange={(e) => setStep(e.target.value as StepKey)}>
                {STEP_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {STEP_LABELS[k]}
                  </option>
                ))}
              </select>
            </label>

            <div className={styles.field}>
              <span>Wat ging er mis?</span>
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
              <span>Ernst</span>
              <div className={styles.chips}>
                {(["klein", "groot"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={[styles.chip, severity === s ? styles.chipOn : ""].join(" ")}
                    onClick={() => setSeverity(s)}
                  >
                    {s === "klein" ? "Klein — even corrigeren" : "Groot — niet bruikbaar"}
                  </button>
                ))}
              </div>
            </div>

            {step === "voorstel" && (
              <label className={styles.field}>
                <span>Sectie (optioneel)</span>
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
              <span>Toelichting (optioneel)</span>
              <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Wat klopte er niet?" />
            </label>

            <div className={styles.actions}>
              <button type="button" className={styles.cancel} onClick={() => dialogRef.current?.close()}>
                Annuleren
              </button>
              <button type="button" className={styles.submit} onClick={() => void submit()} disabled={!category}>
                Vastleggen
              </button>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
