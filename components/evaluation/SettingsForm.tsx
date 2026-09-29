"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Settings } from "@/lib/settings";
import styles from "./SettingsForm.module.css";

/** The assumptions behind the comparison — editable, because they belong in the report. */
export function SettingsForm({ settings }: { settings: Settings }) {
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
      {field("baselineMinutesPerLead", "Manual baseline (minutes per lead)")}
      {field("baselineSource", "Baseline source", "text")}
      {field("hourlyRateEur", "Consultant hourly rate (€)")}
      {field("usdToEur", "Exchange rate USD → EUR")}
      <div className={styles.actions}>
        <button type="submit" className={styles.save} disabled={status === "saving"}>
          {status === "saving" ? "Saving…" : "Save assumptions"}
        </button>
        {status === "saved" && <span className={styles.ok}>✓ Saved</span>}
        {status === "error" && <span className={styles.err}>Could not save</span>}
      </div>
    </form>
  );
}
