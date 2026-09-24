import {
  AlignmentType,
  BorderStyle,
  CharacterSet,
  Document,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TabStopType,
  TextRun,
  WidthType,
  convertMillimetersToTwip,
} from "docx";
import type { ProposalContent } from "./validation";
import { PROPOSAL_SECTIONS } from "./proposalSections";
import { splitParagraphs } from "./proposalDocument";
import { COLORS, FONTS, PAGE, TYPE } from "./proposalLayout";

/** Half-points, the unit docx uses for font sizes. */
const hp = (pt: number) => Math.round(pt * 2);
const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: "auto" } as const;
const CONTENT_WIDTH_TWIP = convertMillimetersToTwip(PAGE.widthMm - 2 * PAGE.marginMm);

/** A text with single newlines as soft line breaks (Shift+Enter in the editor). */
function runs(text: string, opts: { size?: number; font?: string; color?: string } = {}): TextRun[] {
  return text.split("\n").map((line, i) => new TextRun({ text: line, break: i > 0 ? 1 : undefined, ...opts }));
}

function bodyParagraphs(text: string): Paragraph[] {
  return splitParagraphs(text).map((p) => new Paragraph({ children: runs(p) }));
}

function pngSize(png: Buffer): { width: number; height: number } {
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

export async function buildProposalDocx(input: {
  content: ProposalContent;
  companyName: string;
  dateLabel: string;
  versionNumber: number;
  logoPng: Buffer;
  fonts: { body: Buffer; heading: Buffer };
}): Promise<Buffer> {
  const { content, companyName } = input;
  const logo = pngSize(input.logoPng);
  const logoHeightPx = 20;

  const sectionChildren: (Paragraph | Table)[] = [];
  for (const section of PROPOSAL_SECTIONS) {
    sectionChildren.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(section.label)] }));

    if (section.kind === "text") {
      sectionChildren.push(...bodyParagraphs(content[section.key]));
    } else if (section.kind === "list") {
      for (const item of content[section.key]) {
        sectionChildren.push(new Paragraph({ numbering: { reference: "dv-bullet", level: 0 }, spacing: { after: 80 }, children: runs(item) }));
      }
    } else if (section.kind === "phases") {
      content.timeline.phases.forEach((phase, i) => {
        sectionChildren.push(
          new Paragraph({
            keepNext: true,
            spacing: { before: i === 0 ? 0 : 200, after: 60 },
            border: i === 0 ? undefined : { top: { style: BorderStyle.SINGLE, size: 4, color: COLORS.rule, space: 8 } },
            children: [new TextRun({ text: phase.name, font: FONTS.heading, size: hp(TYPE.phasePt) })],
          }),
          ...splitParagraphs(phase.description).map((p) => new Paragraph({ keepLines: true, children: runs(p) })),
        );
      });
    } else {
      // Investment: a shaded one-cell table reads as a callout (paragraph shading has no padding).
      sectionChildren.push(
        new Table({
          width: { size: CONTENT_WIDTH_TWIP, type: WidthType.DXA },
          columnWidths: [CONTENT_WIDTH_TWIP],
          borders: { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER, insideHorizontal: NO_BORDER, insideVertical: NO_BORDER },
          rows: [
            new TableRow({
              cantSplit: true,
              children: [
                new TableCell({
                  width: { size: CONTENT_WIDTH_TWIP, type: WidthType.DXA },
                  shading: { fill: COLORS.callout, type: ShadingType.CLEAR, color: "auto" },
                  margins: { top: 200, bottom: 80, left: 280, right: 280 },
                  children: bodyParagraphs(content.investment),
                }),
              ],
            }),
          ],
        }),
        new Paragraph({ spacing: { after: 0 }, children: [] }),
      );
    }
  }

  const doc = new Document({
    title: `Voorstel voor ${companyName}`,
    subject: "Voorstel",
    creator: "Datavance",
    lastModifiedBy: "Datavance",
    description: `Versie v${input.versionNumber}`,
    keywords: "Datavance, voorstel",
    fonts: [
      { name: FONTS.body, data: input.fonts.body, characterSet: CharacterSet.ANSI },
      { name: FONTS.heading, data: input.fonts.heading, characterSet: CharacterSet.ANSI },
    ],
    styles: {
      default: {
        document: {
          run: { font: FONTS.body, size: hp(TYPE.bodyPt), color: COLORS.text, language: { value: "nl-NL" } },
          paragraph: { spacing: { after: 160, line: Math.round(240 * TYPE.lineHeight) } },
        },
        heading1: {
          run: { font: FONTS.heading, size: hp(TYPE.headingPt), color: COLORS.text, bold: false },
          paragraph: {
            keepNext: true,
            spacing: { before: 360, after: 160 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: COLORS.rule, space: 4 } },
          },
        },
      },
    },
    numbering: {
      config: [
        {
          reference: "dv-bullet",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "•",
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: { indent: { left: 425, hanging: 283 } },
                run: { color: COLORS.bullet },
              },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: convertMillimetersToTwip(PAGE.widthMm), height: convertMillimetersToTwip(PAGE.heightMm) },
            margin: {
              top: convertMillimetersToTwip(PAGE.marginMm),
              bottom: convertMillimetersToTwip(PAGE.marginMm),
              left: convertMillimetersToTwip(PAGE.marginMm),
              right: convertMillimetersToTwip(PAGE.marginMm),
              header: convertMillimetersToTwip(PAGE.headerMm),
              footer: convertMillimetersToTwip(PAGE.footerMm),
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_WIDTH_TWIP }],
                border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: COLORS.text, space: 6 } },
                spacing: { after: 0 },
                children: [
                  new ImageRun({
                    type: "png",
                    data: input.logoPng,
                    transformation: { width: Math.round((logo.width / logo.height) * logoHeightPx), height: logoHeightPx },
                  }),
                  new TextRun({ text: "  Datavance", font: FONTS.heading, size: hp(10) }),
                  new TextRun({ text: `\t${companyName}`, size: hp(9) }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_WIDTH_TWIP }],
                spacing: { after: 0 },
                children: [
                  new TextRun({ text: `Datavance — Vertrouwelijk — ${companyName}`, size: hp(TYPE.runningPt), color: COLORS.muted }),
                  new TextRun({
                    children: ["\tPagina ", PageNumber.CURRENT, " van ", PageNumber.TOTAL_PAGES],
                    size: hp(TYPE.runningPt),
                    color: COLORS.muted,
                  }),
                ],
              }),
            ],
          }),
        },
        children: [
          new Paragraph({
            spacing: { after: 60 },
            children: [new TextRun({ text: `Voorstel voor ${companyName}`, font: FONTS.heading, size: hp(TYPE.titlePt) })],
          }),
          new Paragraph({
            spacing: { after: 360 },
            children: [new TextRun({ text: input.dateLabel, size: hp(TYPE.datePt), color: COLORS.muted })],
          }),
          ...splitParagraphs(content.coverIntro).map(
            (p) => new Paragraph({ children: runs(p, { size: hp(TYPE.introPt) }) }),
          ),
          ...sectionChildren,
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}
