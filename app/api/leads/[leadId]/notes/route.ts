import { NextResponse } from "next/server";
import { z } from "zod";
import { writeConsultantNotes } from "@/lib/leadStore";
import { handleApiError } from "@/lib/apiError";

const bodySchema = z.object({ notes: z.string() });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ leadId: string }> },
) {
  try {
    const { leadId } = await params;
    const { notes } = bodySchema.parse(await request.json());
    await writeConsultantNotes(leadId, notes);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
