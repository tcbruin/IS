import { NextRequest, NextResponse } from "next/server";
import path from "path";
import {
  createLead,
  writeConsultantNotes,
  writeTranscriptRaw,
  writeTranscriptText,
} from "@/lib/leadStore";
import { isSupportedExtension, parseTranscript, SUPPORTED_EXTENSIONS } from "@/lib/parsers";
import { handleApiError } from "@/lib/apiError";
import { logEvent } from "@/lib/telemetry";
import { getLocale } from "@/lib/i18n-server";
import { pick } from "@/lib/i18n";

const MAX_SIZE_BYTES = 10 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const locale = await getLocale();
    const formData = await request.formData();
    const companyName = String(formData.get("companyName") ?? "").trim();
    const leadName = String(formData.get("leadName") ?? "").trim();
    const sourceSystem = String(formData.get("sourceSystem") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim();
    const file = formData.get("file");

    if (!companyName) {
      return NextResponse.json({ error: pick(locale, "Client / company name is required.", "Klant / bedrijfsnaam is verplicht.") }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: pick(locale, "No transcript file received.", "Geen transcriptbestand ontvangen.") }, { status: 400 });
    }

    const ext = path.extname(file.name);
    if (!isSupportedExtension(ext)) {
      return NextResponse.json(
        { error: pick(locale, `Unsupported file type. Use: ${SUPPORTED_EXTENSIONS.join(", ")}.`, `Niet-ondersteund bestandstype. Gebruik: ${SUPPORTED_EXTENSIONS.join(", ")}.`) },
        { status: 400 },
      );
    }
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: pick(locale, "File is larger than 10 MB.", "Het bestand is groter dan 10 MB.") }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const lead = await createLead({
      companyName,
      leadName: leadName || undefined,
      sourceSystem: sourceSystem || undefined,
    });
    await writeTranscriptRaw(lead.id, ext, buffer);
    const text = await parseTranscript(ext, buffer);
    if (!text.trim()) {
      return NextResponse.json(
        { error: pick(locale, "Could not extract any text from the file.", "Er kon geen tekst uit het bestand worden gehaald.") },
        { status: 400 },
      );
    }
    await writeTranscriptText(lead.id, text);
    if (notes) await writeConsultantNotes(lead.id, notes);

    const intakeSeconds = Number(formData.get("intakeSeconds"));
    await logEvent(lead.id, {
      type: "lead_created",
      source: "upload",
      transcriptChars: text.length,
      hasNotes: Boolean(notes),
      hasSourceSystem: Boolean(sourceSystem),
      ...(Number.isFinite(intakeSeconds) && intakeSeconds > 0
        ? { intakeSeconds: Math.round(intakeSeconds) }
        : {}),
    });

    return NextResponse.json({ leadId: lead.id }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
