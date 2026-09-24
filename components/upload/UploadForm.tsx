"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { FormField, TextArea, TextInput } from "@/components/ui/Form";

export function UploadForm() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [leadName, setLeadName] = useState("");
  const [sourceSystem, setSourceSystem] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Kies eerst een transcriptbestand.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("companyName", companyName);
      formData.set("leadName", leadName);
      formData.set("sourceSystem", sourceSystem);
      formData.set("notes", notes);
      formData.set("file", file);
      const res = await fetch("/api/leads", { method: "POST", body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Uploaden mislukt.");
      }
      const { leadId } = await res.json();
      router.push(`/leads/${leadId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Er ging iets mis.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <FormField label="Klant / bedrijfsnaam">
        <TextInput
          required
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          placeholder="Bijv. Acme B.V."
        />
      </FormField>
      <FormField label="Contactpersoon (optioneel)">
        <TextInput
          value={leadName}
          onChange={(e) => setLeadName(e.target.value)}
          placeholder="Bijv. Jane de Vries"
        />
      </FormField>
      <FormField
        label="Bronsysteem (optioneel)"
        hint="Het systeem waar we de data straks uit gaan halen, bijv. voor het voorstel en dashboard."
      >
        <TextInput
          value={sourceSystem}
          onChange={(e) => setSourceSystem(e.target.value)}
          placeholder="Bijv. Exact Online, Twinfield, Excel-sheets..."
        />
      </FormField>
      <FormField
        label="Transcript van het salesgesprek"
        hint="Ondersteunde formaten: .txt, .docx, .srt, .vtt — een audio/video-bestand wordt in v1 nog niet automatisch getranscribeerd."
      >
        <input
          type="file"
          accept=".txt,.docx,.srt,.vtt"
          required
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </FormField>
      <FormField
        label="Notities van de consultant (optioneel)"
        hint="Losse aantekeningen naast het transcript — de AI gebruikt dit als extra context bij elke stap."
      >
        <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Bijv. context over systemen, wat al besproken is, gevoel bij het gesprek..." />
      </FormField>
      {error && <p style={{ color: "var(--color-rood)" }}>{error}</p>}
      <Button type="submit" disabled={submitting}>
        {submitting ? "Bezig met uploaden..." : "Lead aanmaken"}
      </Button>
    </form>
  );
}
