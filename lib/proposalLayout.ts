/**
 * One set of page/typography numbers for the proposal, shared by the on-screen A4 pages, the
 * print/PDF output and the .docx export, so all three look the same.
 */
export const PAGE = {
  widthMm: 210,
  heightMm: 297,
  marginMm: 25,
  /** Distance of the running header/footer from the page edge. */
  headerMm: 12.5,
  footerMm: 12.5,
} as const;

export const TYPE = {
  bodyPt: 11,
  lineHeight: 1.45,
  introPt: 12.5,
  titlePt: 24,
  datePt: 10,
  headingPt: 15,
  phasePt: 11.5,
  runningPt: 8.5,
} as const;

export const FONTS = {
  /** Family names exactly as inside the TTF files in brand/fonts (Word matches on these). */
  body: "Manrope",
  heading: "Epilogue SemiBold",
} as const;

export const COLORS = {
  text: "264549",
  muted: "728689",
  bullet: "629373",
  rule: "E6DDD1",
  callout: "FAECD9",
} as const;

/** CSS px per mm (CSS defines 1in = 96px = 25.4mm). */
export const PX_PER_MM = 96 / 25.4;

/** English long date, e.g. "24 September 2026". */
export function formatDocumentDate(iso: string): string {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const d = new Date(iso);
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}
