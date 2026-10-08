import { NextResponse } from "next/server";
import { loadEvaluation } from "@/lib/evaluationData";
import { evaluationExportRecords } from "@/lib/evaluationExport";
import { toCsv } from "@/lib/evaluation";
import { handleApiError } from "@/lib/apiError";

/** CSV for Excel: selected evaluation mode, semicolons, decimal commas and BOM. */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const type = url.searchParams.get("type") === "events" ? "events" : "leads";
    const requestedMode = url.searchParams.get("mode");
    const data = await loadEvaluation({
      mode: requestedMode === "demo" || requestedMode === "actual" ? requestedMode : undefined,
      includeDemo: url.searchParams.get("demo") === "1",
    });
    const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam" }).format(new Date());
    return new NextResponse(toCsv(evaluationExportRecords(data, type)), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="evaluation-${data.mode}-${type}-${date}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
