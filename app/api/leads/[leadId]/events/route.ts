import { NextResponse } from "next/server";
import { getLead } from "@/lib/leadStore";
import { clientEventSchema } from "@/lib/telemetryEvents";
import { logEvent } from "@/lib/telemetry";
import { handleApiError } from "@/lib/apiError";

/** Client-side telemetry (active time, ratings, failure reports, …). Accepts only the client
 * event types; the timestamp is always set server-side. Body is read as text because
 * navigator.sendBeacon posts without a JSON content type. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ leadId: string }> },
) {
  try {
    const { leadId } = await params;
    await getLead(leadId);
    const event = clientEventSchema.parse(JSON.parse(await request.text()));
    await logEvent(leadId, event);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof SyntaxError) {
      return NextResponse.json({ error: "Ongeldige JSON." }, { status: 400 });
    }
    return handleApiError(err);
  }
}
