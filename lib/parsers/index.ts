import { parseTxt } from "./txt";
import { parseDocx } from "./docx";
import { parseSrtVtt } from "./srtVtt";

export const SUPPORTED_EXTENSIONS = [".txt", ".docx", ".srt", ".vtt"] as const;
export type SupportedExtension = (typeof SUPPORTED_EXTENSIONS)[number];

export function isSupportedExtension(ext: string): ext is SupportedExtension {
  return (SUPPORTED_EXTENSIONS as readonly string[]).includes(ext.toLowerCase());
}

export async function parseTranscript(ext: string, buffer: Buffer): Promise<string> {
  switch (ext.toLowerCase()) {
    case ".txt":
      return parseTxt(buffer);
    case ".docx":
      return parseDocx(buffer);
    case ".srt":
    case ".vtt":
      return parseSrtVtt(buffer);
    default:
      throw new Error(`Unsupported file extension: ${ext}`);
  }
}
