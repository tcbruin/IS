import { NextResponse } from "next/server";
import { deleteLead } from "@/lib/leadStore";
import { handleApiError } from "@/lib/apiError";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ leadId: string }> },
) {
  try {
    const { leadId } = await params;
    await deleteLead(leadId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
