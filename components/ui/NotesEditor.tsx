"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "./Button";
import { TextArea } from "./Form";

export function NotesEditor({
  leadId,
  initialNotes,
  onEditingChange,
}: {
  leadId: string;
  initialNotes: string;
  /** Lets a parent block actions that would ignore unsaved notes (e.g. generating questions). */
  onEditingChange?: (editing: boolean) => void;
}) {
  const router = useRouter();
  const [editing, setEditingState] = useState(false);
  const [notes, setNotes] = useState(initialNotes);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setEditing(value: boolean) {
    setEditingState(value);
    onEditingChange?.(value);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Opslaan mislukt.");
      }
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Er ging iets mis.");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div>
        {initialNotes ? (
          <p style={{ whiteSpace: "pre-wrap", marginTop: 0 }}>{initialNotes}</p>
        ) : (
          <p style={{ opacity: 0.6, marginTop: 0 }}>Nog geen notities.</p>
        )}
        <Button variant="secondary" onClick={() => setEditing(true)}>
          {initialNotes ? "Notities bewerken" : "Notities toevoegen"}
        </Button>
      </div>
    );
  }

  return (
    <div>
      <TextArea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        style={{ width: "100%", minHeight: 140 }}
        autoFocus
      />
      {error && <p style={{ color: "var(--color-rood)" }}>{error}</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <Button onClick={save} disabled={saving}>
          {saving ? "Opslaan..." : "Opslaan"}
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setNotes(initialNotes);
            setEditing(false);
          }}
          disabled={saving}
        >
          Annuleren
        </Button>
      </div>
    </div>
  );
}
