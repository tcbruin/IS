import { NextResponse } from "next/server";
import { z } from "zod";
import { createLead, deleteLead, listLeads, writeConsultantNotes, writeTranscriptText } from "@/lib/leadStore";
import { getScenario, readScenarioFile } from "@/lib/demo";
import { logEvent } from "@/lib/telemetry";
import { handleApiError } from "@/lib/apiError";

const bodySchema = z.object({ scenarioId: z.string(), mode: z.enum(["replay", "live"]) });

/** Starts a demo lead from a scenario. "replay" = recorded AI answers (fast), "live" = real API. */
export async function POST(request: Request) {
  try {
    const { scenarioId, mode } = bodySchema.parse(await request.json());
    const scenario = await getScenario(scenarioId);
    if (!scenario) return NextResponse.json({ error: "Onbekend demoscenario." }, { status: 404 });

    const [transcript, notes] = await Promise.all([
      readScenarioFile(scenario.transcriptFile),
      scenario.notesFile ? readScenarioFile(scenario.notesFile) : Promise.resolve(""),
    ]);
    const lead = await createLead({
      companyName: scenario.companyName,
      leadName: scenario.leadName,
      sourceSystem: scenario.sourceSystem,
      demo: { scenarioId, mode },
    });
    await writeTranscriptText(lead.id, transcript);
    if (notes.trim()) await writeConsultantNotes(lead.id, notes.trim());
    await logEvent(lead.id, {
      type: "lead_created",
      source: "demo",
      transcriptChars: transcript.length,
      hasNotes: Boolean(notes.trim()),
      hasSourceSystem: Boolean(scenario.sourceSystem),
    });

    return NextResponse.json({ leadId: lead.id }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

/** "Demo's opruimen": deletes every lead started from /demo. */
export async function DELETE() {
  try {
    const demoLeads = (await listLeads()).filter((l) => l.demo);
    await Promise.all(demoLeads.map((l) => deleteLead(l.id)));
    return NextResponse.json({ deleted: demoLeads.length });
  } catch (err) {
    return handleApiError(err);
  }
}
