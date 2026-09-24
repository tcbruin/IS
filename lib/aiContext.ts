import type { Answer, Question } from "./validation";
import type { AIContextInputItem } from "@/components/ui/AIContextPanel";

/** Centralizes the copy shown in AIContextPanel across all 4 generation steps, so Dutch strings
 * live in exactly one place instead of being retyped per page (same division of labor as
 * STATE_LABELS: copy lives here, each page decides which inputs/principles apply to it). */

export function truncate(text: string, max = 100): string {
  const trimmed = text.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max).trimEnd()}…` : trimmed;
}

export function transcriptInput(): AIContextInputItem {
  return { label: "Transcript van het gesprek", present: true };
}

export function notesInput(notes: string | null, opts?: { href?: string }): AIContextInputItem {
  return {
    label: "Notities van de consultant",
    present: !!notes?.trim(),
    detail: notes?.trim() ? truncate(notes) : undefined,
    absentText: "Nog geen notities toegevoegd",
    href: notes?.trim() ? opts?.href : undefined,
    linkLabel: "Bekijk notities",
  };
}

export function sourceSystemInput(sourceSystem?: string): AIContextInputItem {
  return {
    label: "Bronsysteem",
    present: !!sourceSystem,
    detail: sourceSystem,
    absentText: "Geen bronsysteem opgegeven",
  };
}

export function answersInput(
  label: string,
  questions: Question[],
  answers: Answer[],
  href: string,
): AIContextInputItem {
  const answeredCount = questions.filter((q) => answers.find((a) => a.questionId === q.id)?.answer?.trim()).length;
  return {
    label,
    present: true,
    detail: `${answeredCount} van ${questions.length} beantwoord`,
    href,
    linkLabel: "Bekijk antwoorden",
  };
}

export function finalProposalInput(version: number, href: string): AIContextInputItem {
  return { label: "Het gefinaliseerde voorstel", present: true, detail: `v${version}`, href, linkLabel: "Bekijk voorstel" };
}

export function examplesInput(count: number): AIContextInputItem {
  return {
    label: "Eerder goedgekeurde voorstellen",
    present: count > 0,
    detail: count > 0 ? `${count}, alleen voor toon en opbouw` : undefined,
    absentText: "Nog geen eerdere voorstellen beschikbaar",
  };
}

export function sampleDataInput(): AIContextInputItem {
  return {
    label: "Illustratieve voorbeelddata",
    present: true,
    detail: "gegenereerd door het systeem volgens het datamodel dat de AI ontwerpt — geen echte klantcijfers",
  };
}

export const QUESTIONS1_PRINCIPLES: string[] = [
  "Kiest één concreet probleem om op door te vragen — ook als er meerdere onderwerpen langskomen.",
  "Stelt geen vragen waar transcript, notities of bronsysteem al antwoord op geven.",
  "Focust op de gaten die het voorstel het meest verbeteren: hoe het nu gaat, hoeveel tijd het kost, welke systemen erbij horen.",
];

export const PROPOSAL_PRINCIPLES: string[] = [
  "Scopet het voorstel op dat ene probleem — geen brede aanpak.",
  "Verzint nooit een concreet bedrag — de investering blijft een placeholder tot een scopingsgesprek.",
  "Schrijft kort en concreet, zonder vage containerbegrippen.",
];

export const PROPOSAL_EXAMPLES_PRINCIPLE =
  "Gebruikt eerder goedgekeurde voorstellen alleen voor toon en opbouw — klantgegevens daaruit worden nooit overgenomen.";

export const QUESTIONS2_PRINCIPLES: string[] = [
  "Blijft dicht bij het ene probleem uit het voorstel — geen brede rapportagewaaier.",
  "Vraagt door op welke cijfers deze klant overtuigen en hoe een goed 'voor vs. na'-verhaal eruitziet.",
  "Vraagt niet opnieuw naar het bronsysteem als dat al bekend is.",
];

export const DASHBOARD_PRINCIPLES: string[] = [
  "Ontwerpt een datamodel en pagina voor dit ene probleem, in de woorden van de klant.",
  "Schrijft zelf geen enkel getal op het dashboard — het systeem genereert de voorbeelddata en rekent alles uit.",
  "Gebruikt alleen cijfers die letterlijk in transcript, notities of antwoorden staan, met citaat; andere worden weggelaten.",
  "Verzint geen norm: zonder genoemde norm vergelijkt het dashboard met het gemiddelde of de vorige periode.",
  "Kiest alleen uit de vaste Power BI-indelingen in de Datavance-huisstijl.",
];
