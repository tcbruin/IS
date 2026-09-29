import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { getLead, getProposalCurrent, getProposalVersion, NotFoundError } from "@/lib/leadStore";
import { buildProposalDocx } from "@/lib/proposalDocx";
import { formatDocumentDate } from "@/lib/proposalLayout";
import { slugify } from "@/lib/slugify";
import { handleApiError } from "@/lib/apiError";

let assets: Promise<{ logoPng: Buffer; fonts: { body: Buffer; heading: Buffer } }> | null = null;

function loadAssets() {
  assets ??= Promise.all([
    fs.readFile(path.join(process.cwd(), "public", "logo.png")),
    fs.readFile(path.join(process.cwd(), "brand", "fonts", "Manrope-Regular.ttf")),
    fs.readFile(path.join(process.cwd(), "brand", "fonts", "Epilogue-SemiBold.ttf")),
  ]).then(([logoPng, body, heading]) => ({ logoPng, fonts: { body, heading } }));
  return assets;
}

/** GET ?version=final | latest | N — defaults to the final version, else the latest. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ leadId: string }> },
) {
  try {
    const { leadId } = await params;
    const [lead, current] = await Promise.all([getLead(leadId), getProposalCurrent(leadId)]);
    if (current.latestVersion === 0) throw new NotFoundError("There is no proposal yet.");

    const requested = new URL(request.url).searchParams.get("version") ?? "final";
    const versionNumber =
      requested === "latest"
        ? current.latestVersion
        : requested === "final"
          ? (current.finalVersion ?? current.latestVersion)
          : Number(requested);
    const version = await getProposalVersion(leadId, versionNumber);
    const isFinal = version.version === current.finalVersion;

    const buffer = await buildProposalDocx({
      content: version.content,
      companyName: lead.companyName,
      dateLabel: formatDocumentDate(version.createdAt),
      versionNumber: version.version,
      ...(await loadAssets()),
    });

    const suffix = isFinal ? "" : `-draft-v${version.version}`;
    const asciiName = `proposal-datavance-${slugify(lead.companyName, "client")}${suffix}.docx`;
    const prettyName = `Proposal ${lead.companyName} - Datavance${isFinal ? "" : ` (draft v${version.version})`}.docx`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(prettyName)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
