"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "./Button";
import { useLanguage } from "@/components/i18n/LanguageProvider";

export function DeleteLeadButton({ leadId }: { leadId: string }) {
  const { text } = useLanguage();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!confirming) {
    return (
      <Button variant="danger" onClick={() => setConfirming(true)}>
        {text("Delete lead", "Lead verwijderen")}
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
      <span>{text("Are you sure?", "Weet je het zeker?")}</span>
      <Button variant="danger" onClick={handleDelete} disabled={deleting}>
        {deleting ? text("Deleting...", "Verwijderen...") : text("Yes, delete", "Ja, verwijderen")}
      </Button>
      <Button variant="secondary" onClick={() => setConfirming(false)} disabled={deleting}>
        {text("Cancel", "Annuleren")}
      </Button>
    </div>
  );
}
