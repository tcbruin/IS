"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";

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
      setError(body.error ?? "Starten mislukt.");
      setBusy(false);
      return;
    }
    router.push(`/leads/${body.leadId}/questions`);
  }

  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 4 }}>
      <Button variant={variant} onClick={() => void start()} disabled={disabled || busy}>
        {busy ? "Bezig…" : label}
      </Button>
      {error && <span style={{ color: "var(--color-rood)", fontSize: 14 }}>{error}</span>}
    </span>
  );
}

export function PingButton() {
  const [state, setState] = useState<{ busy: boolean; text: string | null; ok?: boolean }>({ busy: false, text: null });

  async function ping() {
    setState({ busy: true, text: null });
    const res = await fetch("/api/demo/ping", { method: "POST" });
    const body = await res.json().catch(() => ({ ok: false, error: "Geen antwoord" }));
    setState({
      busy: false,
      ok: body.ok,
      text: body.ok ? `Bereikbaar — ${body.ms} ms (${body.model})` : `Niet bereikbaar: ${body.error ?? "onbekende fout"}`,
    });
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <Button variant="secondary" onClick={() => void ping()} disabled={state.busy}>
        {state.busy ? "Testen…" : "Test AI-verbinding"}
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
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function cleanup() {
    if (!window.confirm(`${count} demo-lead(s) verwijderen? Opnames blijven bewaard.`)) return;
    setBusy(true);
    await fetch("/api/demo", { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }

  return (
    <Button variant="danger" onClick={() => void cleanup()} disabled={busy || count === 0}>
      {busy ? "Bezig…" : "Demo's opruimen"}
    </Button>
  );
}

/** "Opslaan als demo-opname" (lead ⋯ menu): saves this live demo run for fast replays. */
export function SnapshotButton({ leadId }: { leadId: string }) {
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
    setMessage(res.ok ? "Opgeslagen als opname voor snelle demo's." : (body.error ?? "Opslaan mislukt."));
  }

  return (
    <span style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <Button variant="secondary" onClick={() => void snapshot()} disabled={state === "busy"}>
        {state === "busy" ? "Opslaan…" : "Opslaan als demo-opname"}
      </Button>
      {message && (
        <span style={{ fontSize: 13, color: state === "done" ? "var(--color-groen)" : "var(--color-rood)" }}>{message}</span>
      )}
    </span>
  );
}
