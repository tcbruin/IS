import Link from "next/link";
import styles from "./AIContextPanel.module.css";
import { pick, type Locale } from "@/lib/i18n";

const DUTCH_PRINCIPLES: Record<string, string> = {
  "Picks one concrete problem to dig into — even when several topics come up.": "Kiest één concreet probleem om uit te diepen — ook als meerdere onderwerpen aan bod komen.",
  "Doesn't ask questions the transcript, notes, or source system already answer.": "Stelt geen vragen die het transcript, de notities of het bronsysteem al beantwoorden.",
  "Focuses on the gaps that improve the proposal most: how it works today, how much time it takes, which systems are involved.": "Richt zich op de hiaten die het voorstel het meest verbeteren: hoe het nu werkt, hoeveel tijd het kost en welke systemen betrokken zijn.",
  "Scopes the proposal to that one problem — no broad approach.": "Beperkt het voorstel tot dat ene probleem — geen brede aanpak.",
  "Opens with Situation, Complication, one Question and Datavance's Answer — as a natural story, without framework labels.": "Opent met Situatie, Complicatie, één Vraag en het Antwoord van Datavance — als natuurlijk verhaal, zonder methodieklabels.",
  "Targets 350–400 words in four compact blocks on one A4 page.": "Streeft naar 350–400 woorden in vier compacte blokken op één A4-pagina.",
  "Never makes up a specific amount — the investment stays a placeholder until a scoping call.": "Verzint nooit een concreet bedrag — de investering blijft een tijdelijke tekst tot het scopegesprek.",
  "Writes short and concrete, without vague buzzwords.": "Schrijft kort en concreet, zonder vage modewoorden.",
  "Uses previously approved proposals for tone and structure only — client details from them are never copied.": "Gebruikt eerder goedgekeurde voorstellen alleen voor toon en structuur — klantdetails worden nooit overgenomen.",
  "Stays close to the one problem from the proposal — no broad spread of reports.": "Blijft dicht bij het ene probleem uit het voorstel — geen brede verzameling rapportages.",
  "Asks which numbers will convince this client and what a good 'before vs. after' story looks like.": "Vraagt welke cijfers deze klant overtuigen en hoe een goed verhaal van 'voor naar na' eruitziet.",
  "Doesn't ask about the source system again if it's already known.": "Vraagt niet opnieuw naar het bronsysteem als dat al bekend is.",
  "Designs a data model and page for this one problem, in the client's own words.": "Ontwerpt een datamodel en pagina voor dit ene probleem, in de woorden van de klant.",
  "Writes no numbers on the dashboard itself — the system generates the sample data and calculates everything.": "Schrijft zelf geen cijfers op het dashboard — het systeem genereert de voorbeelddata en berekent alles.",
  "Only uses figures stated literally in the transcript, notes, or answers, with a quote; others are left out.": "Gebruikt alleen cijfers die letterlijk in het transcript, de notities of antwoorden staan, met citaat; andere cijfers blijven weg.",
  "Doesn't invent a target: without a stated target, the dashboard compares against the average or the previous period.": "Verzint geen doelwaarde: zonder genoemd doel vergelijkt het dashboard met het gemiddelde of de vorige periode.",
  "Only picks from the fixed Power BI layouts in the Datavance brand style.": "Kiest alleen uit de vaste Power BI-indelingen in de huisstijl van Datavance.",
};

export interface AIContextInputItem {
  label: string;
  present: boolean;
  /** Shown after the label when present, e.g. a value, an excerpt, or a count. */
  detail?: string;
  /** Shown instead of a generic "not available" line when !present. */
  absentText?: string;
  /** Optional "View ..." link, only rendered when present. */
  href?: string;
  linkLabel?: string;
}

/** Transparency at each AI step: what the AI based this on and which rules it follows.
 * Collapsed by default (native <details>) so it never competes with the task on screen, but
 * always in the same spot and one click away — the summary line itself already says how many
 * sources and rules there are. */
export function AIContextPanel({
  inputs,
  principles,
  locale = "en",
}: {
  inputs: AIContextInputItem[];
  principles: string[];
  locale?: Locale;
}) {
  const sourceCount = inputs.filter((i) => i.present).length;
  return (
    <details className={["no-print", styles.panel].join(" ")}>
      <summary className={styles.summary}>
        <span className={styles.summaryTitle}>{pick(locale, "What is this based on?", "Waarop is dit gebaseerd?")}</span>
        <span className={styles.summaryMeta}>
          {sourceCount} {sourceCount === 1 ? pick(locale, "source", "bron") : pick(locale, "sources", "bronnen")} · {principles.length}{" "}
          {principles.length === 1 ? pick(locale, "rule", "regel") : pick(locale, "rules", "regels")}
        </span>
      </summary>

      <div className={styles.body}>
        <div>
          <div className={styles.groupLabel}>{pick(locale, "Based on", "Gebaseerd op")}</div>
          <ul className={styles.inputList}>
            {inputs.map((item) => (
              <li key={item.label} className={styles.inputRow}>
                <span aria-hidden="true" className={item.present ? styles.iconYes : styles.iconNo}>
                  {item.present ? "✓" : "—"}
                </span>
                <span>
                  <span className={styles.inputLabel}>{item.label}</span>
                  {item.present && item.detail && <span className={styles.detail}> — {item.detail}</span>}
                  {!item.present && item.absentText && <span className={styles.absent}> — {item.absentText}</span>}
                  {item.present && item.href && (
                    <>
                      {" "}
                      <Link href={item.href} className={styles.link}>
                        {item.linkLabel ?? pick(locale, "View", "Bekijken")}
                      </Link>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className={styles.groupLabel}>{pick(locale, "Rules the AI follows", "Regels die de AI volgt")}</div>
          <ul className={styles.principleList}>
            {principles.map((p) => (
              <li key={p}>{locale === "nl" ? (DUTCH_PRINCIPLES[p] ?? p) : p}</li>
            ))}
          </ul>
        </div>
      </div>
    </details>
  );
}
