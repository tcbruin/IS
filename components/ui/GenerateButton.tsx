"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

export function GenerateButton({
  url,
  body,
  label,
  busyLabel,
  variant = "primary",
  autoTrigger = false,
  redirectTo,
  confirmMessage,
  disabled = false,
}: {
  url: string;
  body?: unknown;
  label: string;
  busyLabel?: string;
  variant?: "primary" | "secondary" | "danger";
  /** Fire the request once on mount instead of waiting for a click — for "cold start this step"
   * screens with no other content to lose (never use where a sibling form has unsaved state). */
  autoTrigger?: boolean;
  /** On success, navigate here instead of router.refresh() — lets the next step's own
   * autoTrigger start immediately, collapsing two clicks into one. */
  redirectTo?: string;
  /** Ask for confirmation first (native confirm) — for actions that rewind the workflow. */
  confirmMessage?: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(autoTrigger);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const firedRef = useRef(false);

  // Seconds counter while busy — AI calls take 5–40 s, and a visibly moving number reads as
  // "working" rather than "stuck".
  useEffect(() => {
    if (!submitting) return;
    setElapsed(0);
    const started = Date.now();
    const id = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(id);
  }, [submitting]);

  async function handleClick() {
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Actie mislukt.");
      }
      if (redirectTo) {
        router.push(redirectTo);
      }
      // Also after a push: the lead layout (header + step bar) stays mounted across client
      // navigation and would otherwise keep showing the pre-action state.
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Er ging iets mis.");
    } finally {
      // Some callers (e.g. "Opnieuw genereren") stay mounted in the exact same spot after a
      // successful router.refresh() — without this, the button would stay stuck on its busy
      // label forever. Redirect-bound callers unmount anyway, so resetting here is harmless.
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (!autoTrigger || firedRef.current) return;
    firedRef.current = true;
    handleClick();
    // Only ever fires once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <Button variant={variant} onClick={handleClick} disabled={submitting || disabled}>
        {submitting ? `${busyLabel ?? "Bezig..."}${elapsed > 0 ? ` ${elapsed} s` : ""}` : label}
      </Button>
      {error && <p style={{ color: "var(--color-rood)", margin: "8px 0 0" }}>{error}</p>}
    </div>
  );
}
