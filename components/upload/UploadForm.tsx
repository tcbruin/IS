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
  // Time spent on the intake form counts as active time in the evaluation.
  const [openedAt] = useState(() => Date.now());

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Choose a transcript file first.");
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
        throw new Error(body.error ?? "Upload failed.");
      }
      const { leadId } = await res.json();
      router.push(`/leads/${leadId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <FormField label="Client / company name">
        <TextInput
          required
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          placeholder="E.g. Acme B.V."
        />
      </FormField>
      <FormField label="Contact person (optional)">
        <TextInput
          value={leadName}
          onChange={(e) => setLeadName(e.target.value)}
          placeholder="E.g. Jane Smith"
        />
      </FormField>
      <FormField
        label="Source system (optional)"
        hint="The system we will pull the data from, e.g. for the proposal and dashboard."
      >
        <TextInput
          value={sourceSystem}
          onChange={(e) => setSourceSystem(e.target.value)}
          placeholder="E.g. Exact Online, Twinfield, Excel sheets..."
        />
      </FormField>
      <FormField
        label="Sales call transcript"
        hint="Supported formats: .txt, .docx, .srt, .vtt — audio/video files are not transcribed automatically in v1."
      >
        <input
          type="file"
          accept=".txt,.docx,.srt,.vtt"
          required
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </FormField>
      <FormField
        label="Consultant notes (optional)"
        hint="Loose notes alongside the transcript — the AI uses them as extra context at every step."
      >
        <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="E.g. context on systems, what has been discussed, your impression of the call..." />
      </FormField>
      {error && <p style={{ color: "var(--color-rood)" }}>{error}</p>}
      <Button type="submit" disabled={submitting}>
        {submitting ? "Uploading..." : "Create lead"}
      </Button>
    </form>
  );
}
