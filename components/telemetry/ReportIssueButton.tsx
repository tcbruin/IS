"use client";

import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { getStepForRoute } from "@/lib/workflow";
import { FAILURE_CATEGORIES, STEP_KEYS, type StepKey } from "@/lib/telemetryEvents";
import { getProposalSections } from "@/lib/proposalSections";
import { track } from "./track";
import styles from "./ReportIssueButton.module.css";
import { useLanguage } from "@/components/i18n/LanguageProvider";

const STEP_LABELS: Record<StepKey, string> = {
  call: "Call & questions",
  proposal: "Proposal",
  dashboard: "Dashboard",
  send: "Send",
};

/** Quiet "Report an issue" in the lead header: logs what went wrong for the failure analysis.
 * Native <dialog>, the step is pre-filled from the page you're on. */
export function ReportIssueButton({ leadId }: { leadId: string }) {
  const { locale, text } = useLanguage();
  const stepLabels: Record<StepKey, string> = locale === "nl" ? {
    call: "Gesprek & vragen", proposal: "Voorstel", dashboard: "Dashboard", send: "Versturen",
  } : STEP_LABELS;
  const categoryLabels: Record<(typeof FAILURE_CATEGORIES)[number], string> = {
    "Invented fact": text("Invented fact", "Verzonnen feit"),
    "Wrong scope": text("Wrong scope", "Verkeerde scope"),
    "Incorrect estimate": text("Incorrect estimate", "Onjuiste inschatting"),
    "Tone/style": text("Tone/style", "Toon/stijl"),
    Incomplete: text("Incomplete", "Onvolledig"),
    Technical: text("Technical", "Technisch"),
    Other: text("Other", "Overig"),
  };
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
        {text("Report an issue", "Probleem melden")}
      </button>
      <dialog ref={dialogRef} className={styles.dialog} onClick={(e) => e.target === dialogRef.current && dialogRef.current?.close()}>
        {sent ? (
          <p className={styles.thanks}>✓ {text("Logged — thank you. This counts toward the failure analysis.", "Vastgelegd — bedankt. Dit telt mee voor de foutenanalyse.")}</p>
        ) : (
          <div className={styles.body}>
            <h3 className={styles.title}>{text("Report an issue", "Probleem melden")}</h3>

            <label className={styles.field}>
              <span>{text("Step", "Stap")}</span>
              <select value={step} onChange={(e) => setStep(e.target.value as StepKey)}>
                {STEP_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {stepLabels[k]}
                  </option>
                ))}
              </select>
            </label>

            <div className={styles.field}>
              <span>{text("What went wrong?", "Wat ging er mis?")}</span>
              <div className={styles.chips}>
                {FAILURE_CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={[styles.chip, category === c ? styles.chipOn : ""].join(" ")}
                    onClick={() => setCategory(c)}
                  >
                    {categoryLabels[c]}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.field}>
              <span>{text("Severity", "Ernst")}</span>
              <div className={styles.chips}>
                {(["minor", "major"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={[styles.chip, severity === s ? styles.chipOn : ""].join(" ")}
                    onClick={() => setSeverity(s)}
                  >
                    {s === "minor" ? text("Minor — quick fix", "Klein — snel op te lossen") : text("Major — not usable", "Groot — niet bruikbaar")}
                  </button>
                ))}
              </div>
            </div>

            {step === "proposal" && (
              <label className={styles.field}>
                <span>{text("Section (optional)", "Onderdeel (optioneel)")}</span>
                <select value={section} onChange={(e) => setSection(e.target.value)}>
                  <option value="">—</option>
                  {getProposalSections(locale).map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className={styles.field}>
              <span>{text("Details (optional)", "Details (optioneel)")}</span>
              <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder={text("What was wrong?", "Wat ging er mis?")} />
            </label>

            <div className={styles.actions}>
              <button type="button" className={styles.cancel} onClick={() => dialogRef.current?.close()}>
                {text("Cancel", "Annuleren")}
              </button>
              <button type="button" className={styles.submit} onClick={() => void submit()} disabled={!category}>
                {text("Log issue", "Probleem vastleggen")}
              </button>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
