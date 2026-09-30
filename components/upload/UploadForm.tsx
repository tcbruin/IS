"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { FormField, TextArea, TextInput } from "@/components/ui/Form";
import { useLanguage } from "@/components/i18n/LanguageProvider";

export function UploadForm() {
  const { text } = useLanguage();
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [leadName, setLeadName] = useState("");
  const [sourceSystem, setSourceSystem] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Time spent on the intake form counts as active time in the evaluation.
  const [openedAt] = useState(() => Date.now());

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError(text("Choose a transcript file first.", "Kies eerst een transcriptbestand."));
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
      formData.set("intakeSeconds", String(Math.round((Date.now() - openedAt) / 1000)));
      const res = await fetch("/api/leads", { method: "POST", body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? text("Upload failed.", "Uploaden is mislukt."));
      }
      const { leadId } = await res.json();
      router.push(`/leads/${leadId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : text("Something went wrong.", "Er is iets misgegaan."));
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <FormField label={text("Client / company name", "Klant / bedrijfsnaam")}>
        <TextInput
          required
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          placeholder={text("E.g. Acme B.V.", "Bijv. Acme B.V.")}
        />
      </FormField>
      <FormField label={text("Contact person (optional)", "Contactpersoon (optioneel)")}>
        <TextInput
          value={leadName}
          onChange={(e) => setLeadName(e.target.value)}
          placeholder={text("E.g. Jane Smith", "Bijv. Jan de Vries")}
        />
      </FormField>
      <FormField
        label={text("Source system (optional)", "Bronsysteem (optioneel)")}
        hint={text("The system we will pull the data from, e.g. for the proposal and dashboard.", "Het systeem waaruit we de gegevens ophalen, bijvoorbeeld voor het voorstel en dashboard.")}
      >
        <TextInput
          value={sourceSystem}
          onChange={(e) => setSourceSystem(e.target.value)}
          placeholder={text("E.g. Exact Online, Twinfield, Excel sheets...", "Bijv. Exact Online, Twinfield, Excel-bestanden...")}
        />
      </FormField>
      <FormField
        label={text("Sales call transcript", "Transcript van verkoopgesprek")}
        hint={text("Supported formats: .txt, .docx, .srt, .vtt — audio/video files are not transcribed automatically in v1.", "Ondersteunde formaten: .txt, .docx, .srt, .vtt — audio- en videobestanden worden in v1 niet automatisch getranscribeerd.")}
      >
        <input
          type="file"
          accept=".txt,.docx,.srt,.vtt"
          required
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </FormField>
      <FormField
        label={text("Consultant notes (optional)", "Notities van consultant (optioneel)")}
        hint={text("Loose notes alongside the transcript — the AI uses them as extra context at every step.", "Losse notities naast het transcript — de AI gebruikt ze bij iedere stap als extra context.")}
      >
        <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={text("E.g. context on systems, what has been discussed, your impression of the call...", "Bijv. context over systemen, wat is besproken en je indruk van het gesprek...")} />
      </FormField>
      {error && <p style={{ color: "var(--color-rood)" }}>{error}</p>}
      <Button type="submit" disabled={submitting}>
        {submitting ? text("Uploading...", "Uploaden...") : text("Create lead", "Lead aanmaken")}
      </Button>
    </form>
  );
}
