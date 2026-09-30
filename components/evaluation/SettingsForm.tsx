"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Settings } from "@/lib/settings";
import styles from "./SettingsForm.module.css";
import { useLanguage } from "@/components/i18n/LanguageProvider";

/** The assumptions behind the comparison — editable, because they belong in the report. */
export function SettingsForm({ settings }: { settings: Settings }) {
  const { text } = useLanguage();
  const router = useRouter();
  const [values, setValues] = useState({
    baselineMinutesPerLead: String(settings.baselineMinutesPerLead),
    baselineSource: settings.baselineSource,
    hourlyRateEur: String(settings.hourlyRateEur),
    usdToEur: String(settings.usdToEur),
  });
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        baselineMinutesPerLead: Number(values.baselineMinutesPerLead),
        baselineSource: values.baselineSource,
        hourlyRateEur: Number(values.hourlyRateEur),
        usdToEur: Number(values.usdToEur.replace(",", ".")),
      }),
    });
    setStatus(res.ok ? "saved" : "error");
    if (res.ok) router.refresh();
  }

  const field = (key: keyof typeof values, label: string, type = "number") => (
    <label className={styles.field}>
      <span>{label}</span>
      <input
        type={type}
        step="any"
        value={values[key]}
        onChange={(e) => {
          setValues({ ...values, [key]: e.target.value });
          setStatus("idle");
        }}
      />
    </label>
  );

  return (
    <form onSubmit={save} className={styles.form}>
      {field("baselineMinutesPerLead", text("Manual baseline (minutes per lead)", "Handmatige nulmeting (minuten per lead)"))}
      {field("baselineSource", text("Baseline source", "Bron van nulmeting"), "text")}
      {field("hourlyRateEur", text("Consultant hourly rate (€)", "Uurtarief consultant (€)"))}
      {field("usdToEur", text("Exchange rate USD → EUR", "Wisselkoers USD → EUR"))}
      <div className={styles.actions}>
        <button type="submit" className={styles.save} disabled={status === "saving"}>
          {status === "saving" ? text("Saving…", "Opslaan…") : text("Save assumptions", "Aannames opslaan")}
        </button>
        {status === "saved" && <span className={styles.ok}>✓ {text("Saved", "Opgeslagen")}</span>}
        {status === "error" && <span className={styles.err}>{text("Could not save", "Opslaan is mislukt")}</span>}
      </div>
    </form>
  );
}
