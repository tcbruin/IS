import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { getDashboard, getLead } from "@/lib/leadStore";
import { renderDashboardExport } from "@/lib/dashboardExport";
import { slugify } from "@/lib/slugify";
import { handleApiError } from "@/lib/apiError";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ leadId: string }> },
) {
  try {
    const { leadId } = await params;
    const [lead, record, logoBuffer] = await Promise.all([
      getLead(leadId),
      getDashboard(leadId),
      fs.readFile(path.join(process.cwd(), "public", "logo.png")),
    ]);

    const html = await renderDashboardExport({
      record,
      companyName: lead.companyName,
      logoBase64: logoBuffer.toString("base64"),
    });

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="dashboard-${slugify(lead.companyName, "dashboard")}.html"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
