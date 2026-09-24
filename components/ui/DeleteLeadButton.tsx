"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "./Button";

export function DeleteLeadButton({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!confirming) {
    return (
      <Button variant="danger" onClick={() => setConfirming(true)}>
        Lead verwijderen
      </Button>
    );
  }

  async function handleDelete() {
    setDeleting(true);
    await fetch(`/api/leads/${leadId}`, { method: "DELETE" });
    router.push("/");
  }

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <span>Zeker weten?</span>
      <Button variant="danger" onClick={handleDelete} disabled={deleting}>
        {deleting ? "Bezig..." : "Ja, verwijderen"}
      </Button>
      <Button variant="secondary" onClick={() => setConfirming(false)} disabled={deleting}>
        Annuleren
      </Button>
    </div>
  );
}
