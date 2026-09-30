"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useLanguage } from "@/components/i18n/LanguageProvider";

/** Creates a demo lead from a scenario and opens it. */
export function StartDemoButton({
  scenarioId,
  mode,
  label,
  disabled,
  variant = "primary",
}: {
  scenarioId: string;
  mode: "replay" | "live";
  label: string;
  disabled?: boolean;
  variant?: "primary" | "secondary";
}) {
  const { text } = useLanguage();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/demo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenarioId, mode }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? text("Could not start the demo.", "De demo kon niet worden gestart."));
      setBusy(false);
      return;
    }
    router.push(`/leads/${body.leadId}/questions`);
  }

  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 4 }}>
      <Button variant={variant} onClick={() => void start()} disabled={disabled || busy}>
        {busy ? text("Working…", "Bezig…") : label}
      </Button>
      {error && <span style={{ color: "var(--color-rood)", fontSize: 14 }}>{error}</span>}
    </span>
  );
}

export function PingButton() {
  const { text } = useLanguage();
  const [state, setState] = useState<{ busy: boolean; text: string | null; ok?: boolean }>({ busy: false, text: null });

  async function ping() {
    setState({ busy: true, text: null });
    const res = await fetch("/api/demo/ping", { method: "POST" });
    const body = await res.json().catch(() => ({ ok: false, error: text("No response", "Geen reactie") }));
    setState({
      busy: false,
      ok: body.ok,
      text: body.ok ? `${text("Reachable", "Bereikbaar")} — ${body.ms} ms (${body.model})` : `${text("Not reachable", "Niet bereikbaar")}: ${body.error ?? text("unknown error", "onbekende fout")}`,
    });
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <Button variant="secondary" onClick={() => void ping()} disabled={state.busy}>
        {state.busy ? text("Testing…", "Testen…") : text("Test AI connection", "AI-verbinding testen")}
      </Button>
      {state.text && (
        <span style={{ fontWeight: 700, fontSize: 15, color: state.ok ? "var(--color-groen)" : "var(--color-rood)" }}>
          {state.ok ? "✓ " : "✗ "}
          {state.text}
        </span>
      )}
    </span>
  );
}

export function CleanupButton({ count }: { count: number }) {
  const { text } = useLanguage();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function cleanup() {
    if (!window.confirm(text(`Delete ${count} demo lead(s)? Recordings are kept.`, `${count} demo-lead(s) verwijderen? Opnamen blijven bewaard.`))) return;
    setBusy(true);
    await fetch("/api/demo", { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }

  return (
    <Button variant="danger" onClick={() => void cleanup()} disabled={busy || count === 0}>
      {busy ? text("Working…", "Bezig…") : text("Clean up demos", "Demo's opruimen")}
    </Button>
  );
}

/** "Save as demo recording" (lead ⋯ menu): saves this live demo run for fast replays. */
export function SnapshotButton({ leadId }: { leadId: string }) {
  const { text } = useLanguage();
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function snapshot() {
    setState("busy");
    const res = await fetch("/api/demo/snapshot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId }),
    });
    const body = await res.json().catch(() => ({}));
    setState(res.ok ? "done" : "error");
    setMessage(res.ok ? text("Saved as a recording for quick demos.", "Opgeslagen als opname voor snelle demo's.") : (body.error ?? text("Could not save.", "Opslaan is mislukt.")));
  }

  return (
    <span style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <Button variant="secondary" onClick={() => void snapshot()} disabled={state === "busy"}>
        {state === "busy" ? text("Saving…", "Opslaan…") : text("Save as demo recording", "Opslaan als demo-opname")}
      </Button>
      {message && (
        <span style={{ fontSize: 13, color: state === "done" ? "var(--color-groen)" : "var(--color-rood)" }}>{message}</span>
      )}
    </span>
  );
}
