import { NextResponse } from "next/server";
import { saveSettings, settingsSchema } from "@/lib/settings";
import { handleApiError } from "@/lib/apiError";

/** Updates the evaluation assumptions (baseline minutes, hourly rate, exchange rate…). */
export async function POST(request: Request) {
  try {
    const patch = settingsSchema.partial().parse(await request.json());
    return NextResponse.json(await saveSettings(patch));
  } catch (err) {
    return handleApiError(err);
  }
}
