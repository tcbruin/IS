"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { GenerateButton } from "@/components/ui/GenerateButton";
import { track } from "@/components/telemetry/track";
import type { CoverEmail } from "@/lib/validation";
import styles from "./CoverEmailPanel.module.css";

export function CoverEmailPanel({
  leadId,
  initialEmail,
}: {
  leadId: string;
  initialEmail: CoverEmail | null;
}) {
  const router = useRouter();
  // Derived from the prop, not snapshotted into local state at mount: router.refresh() delivers
  // the newly-generated initialEmail to this SAME component instance without unmounting it, so
  // state seeded only once at mount would never notice the prop changing under it.
  const generating = initialEmail === null;
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const firedRef = useRef(false);

  useEffect(() => {
    if (initialEmail !== null || firedRef.current) return;
    firedRef.current = true;
    (async () => {
      try {
        const res = await fetch(`/api/leads/${leadId}/send/draft-email`, { method: "POST" });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Opstellen van de e-mail mislukt.");
        }
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Er ging iets mis.");
      }
    })();
    // Only ever fires once, on first mount without an existing draft — router.refresh() (on
    // success) re-renders this component with initialEmail set, which is what stops it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCopy() {
    if (!initialEmail) return;
    await navigator.clipboard.writeText(`Onderwerp: ${initialEmail.subject}\n\n${initialEmail.body}`);
    void track(leadId, { type: "email_copied" });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (error) {
    return <p style={{ color: "var(--color-rood)" }}>{error}</p>;
  }

  if (generating) {
    return <p style={{ margin: 0, opacity: 0.75 }}>De AI stelt een korte begeleidende e-mail op...</p>;
  }

  if (!initialEmail) return null;

  return (
    <div className={styles.panel}>
      <div className={styles.field}>
        <div className={styles.label}>Onderwerp</div>
        <div className={styles.subject}>{initialEmail.subject}</div>
      </div>
      <div className={styles.field}>
        <div className={styles.label}>Bericht</div>
        <div className={styles.body}>{initialEmail.body}</div>
      </div>
      <div className={styles.actions}>
        <Button variant="secondary" onClick={handleCopy}>
          {copied ? "Gekopieerd!" : "Kopieer naar klembord"}
        </Button>
        <GenerateButton
          url={`/api/leads/${leadId}/send/draft-email`}
          label="Opnieuw genereren"
          busyLabel="Bezig..."
          variant="secondary"
        />
      </div>
    </div>
  );
}
