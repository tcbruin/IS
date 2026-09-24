const TIMESTAMP_LINE = /^\s*(\d{2}:)?\d{2}:\d{2}[.,]\d{3}\s*-->\s*(\d{2}:)?\d{2}:\d{2}[.,]\d{3}/;
const CUE_NUMBER_LINE = /^\s*\d+\s*$/;

/**
 * Strips SRT/VTT structure (headers, cue numbers, timestamps) while keeping dialogue text.
 * Cue blocks are separated by a blank line in the source format, so each block is joined into
 * one paragraph — this keeps turn-taking readable even when a single utterance wraps lines.
 */
export function parseSrtVtt(buffer: Buffer): string {
  const raw = buffer.toString("utf-8");
  const blocks = raw.replace(/\r\n/g, "\n").split(/\n\s*\n/);
  const paragraphs: string[] = [];

  for (const block of blocks) {
    const lines = block
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .filter((l) => l !== "WEBVTT")
      .filter((l) => !l.startsWith("NOTE"))
      .filter((l) => !CUE_NUMBER_LINE.test(l))
      .filter((l) => !TIMESTAMP_LINE.test(l));

    if (lines.length > 0) {
      paragraphs.push(lines.join(" "));
    }
  }

  return paragraphs.join("\n").trim();
}
