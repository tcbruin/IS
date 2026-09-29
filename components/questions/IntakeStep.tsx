"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { NotesEditor } from "@/components/ui/NotesEditor";
import { GenerateButton } from "@/components/ui/GenerateButton";
import { StepActions } from "@/components/ui/StepActions";

/** Step 1.1: check/add consultant notes, then let the AI generate questions. Generating stays
 * a deliberate click (not auto-started) and is blocked while notes are being edited, so
 * unsaved notes can never be silently left out of the questions. */
export function IntakeStep({ leadId, notes }: { leadId: string; notes: string }) {
  const [editingNotes, setEditingNotes] = useState(false);
  return (
    <>
      <Card variant="creme">
        <h2 style={{ marginTop: 0 }}>Consultant notes</h2>
        <NotesEditor leadId={leadId} initialNotes={notes} onEditingChange={setEditingNotes} />
      </Card>
      <StepActions>
        {editingNotes && <span style={{ fontSize: 15, opacity: 0.7 }}>Save your notes first</span>}
        <GenerateButton
          url={`/api/leads/${leadId}/questions`}
          label="Generate questions →"
          busyLabel="Analyzing transcript..."
          disabled={editingNotes}
        />
      </StepActions>
    </>
  );
}
