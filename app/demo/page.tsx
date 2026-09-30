import Link from "next/link";
import { listLeads } from "@/lib/leadStore";
import { getRecordingStatus, listScenarios, RECORDED_STEPS } from "@/lib/demo";
import { PROMPT_VERSIONS } from "@/lib/llm";
import { Card } from "@/components/ui/Card";
import { CleanupButton, PingButton, StartDemoButton } from "@/components/demo/DemoControls";
import styles from "./page.module.css";
import { getLocale } from "@/lib/i18n-server";
import { localeTag, pick } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const STEP_NAMES: Record<string, string> = {
  questions1: "questions",
  proposal: "proposal",
  questions2: "dashboard questions",
  dashboard: "dashboard",
  coverEmail: "email",
};

/** Presenter page: pre-flight checks and one-click demo scenarios. */
export default async function DemoPage() {
  const [scenarios, leads, locale] = await Promise.all([listScenarios(), listLeads(), getLocale()]);
  const statuses = await Promise.all(scenarios.map((s) => getRecordingStatus(s.id)));
  const demoLeads = leads.filter((l) => l.demo);
  const hasKey = Boolean(process.env.LLM_API_KEY ?? process.env.DEEPSEEK_API_KEY);

  return (
    <div className={styles.page}>
      <Link href="/" className={styles.back}>
        &larr; {pick(locale, "All leads", "Alle leads")}
      </Link>
      <div>
        <h1 className={styles.title}>Demo</h1>
        <p className={styles.subtitle}>
          {pick(locale, <>For presentations. <strong>Fast</strong> replays a previously recorded AI run (±1.5 s per step, no internet needed for the AI). <strong>Live AI</strong> uses the real API — that is also how you make a new recording.</>, <>Voor presentaties. <strong>Snel</strong> speelt een eerder opgenomen AI-run af (±1,5 s per stap, geen internet nodig voor de AI). <strong>Live-AI</strong> gebruikt de echte API — zo maak je ook een nieuwe opname.</>)}
        </p>
      </div>

      <Card>
        <h2 className={styles.h2}>{pick(locale, "Pre-flight checklist", "Checklist vooraf")}</h2>
        <ul className={styles.checklist}>
          <li>
            <span className={hasKey ? styles.ok : styles.bad}>{hasKey ? "✓" : "✗"}</span> {pick(locale, "API key", "API-sleutel")}{" "}
            {hasKey ? pick(locale, "configured", "ingesteld") : pick(locale, "missing — only fast demos will work", "ontbreekt — alleen snelle demo's werken")}
          </li>
          <li className={styles.pingRow}>
            <PingButton />
          </li>
          {scenarios.map((s, i) => (
            <li key={s.id}>
              <span className={statuses[i].complete ? styles.ok : styles.warn}>{statuses[i].complete ? "✓" : "–"}</span> {pick(locale, "Recording", "Opname")}{" "}
              {s.companyName}: {statuses[i].complete ? pick(locale, "complete", "compleet") : pick(locale, "not (fully) recorded yet", "nog niet volledig opgenomen")}
            </li>
          ))}
          <li className={styles.cleanupRow}>
            <span>
              {demoLeads.length} demo {demoLeads.length === 1 ? "lead" : "leads"} {pick(locale, "in the list", "in de lijst")}
            </span>
            <CleanupButton count={demoLeads.length} />
          </li>
        </ul>
      </Card>

      <div className={styles.grid}>
        {scenarios.map((s, i) => {
          const status = statuses[i];
          const outdated = status.meta
            ? Object.entries(status.meta.promptVersions).filter(([step, v]) => PROMPT_VERSIONS[step] && PROMPT_VERSIONS[step] !== v)
            : [];
          return (
            <Card key={s.id} className={styles.scenario}>
              <h3 className={styles.company}>{s.companyName}</h3>
              <p className={styles.meta}>{[s.leadName, s.sourceSystem].filter(Boolean).join(" · ")}</p>
              <p className={styles.pitch}>{s.pitch}</p>
              <p className={styles.recording}>
                {status.complete && status.meta ? (
                  <>
                    {pick(locale, "Recorded on", "Opgenomen op")} {new Date(status.meta.recordedAt).toLocaleDateString(localeTag(locale))} ({status.meta.model})
                    {outdated.length > 0 && (
                      <span className={styles.outdated}>
                        {" "}
                        · {pick(locale, "made with an older prompt for", "gemaakt met een oudere prompt voor")} {outdated.map(([step]) => STEP_NAMES[step] ?? step).join(", ")}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    {pick(locale, "No complete recording yet", "Nog geen complete opname")}
                    {Object.values(status.steps).some(Boolean) &&
                      ` (${pick(locale, "available", "beschikbaar")}: ${RECORDED_STEPS.filter((st) => status.steps[st]).map((st) => STEP_NAMES[st]).join(", ")})`}
                    . {pick(locale, "Start live, run through the demo and choose “Save as demo recording” in the ⋯ menu.", "Start live, doorloop de demo en kies ‘Opslaan als demo-opname’ in het ⋯-menu.")}
                  </>
                )}
              </p>
              <div className={styles.actions}>
                <StartDemoButton scenarioId={s.id} mode="replay" label={pick(locale, "Start (fast)", "Start (snel)")} disabled={!status.complete} />
                <StartDemoButton scenarioId={s.id} mode="live" label={pick(locale, "Start (live AI)", "Start (live-AI)")} variant="secondary" disabled={!hasKey} />
              </div>
            </Card>
          );
        })}
      </div>

      <Card variant="creme">
        <h2 className={styles.h2}>{pick(locale, "Presentation tips", "Presentatietips")}</h2>
        <ul className={styles.tips}>
          {locale === "nl" ? (
            <>
              <li>Is wifi of tijd onzeker, kies dan <strong>Snel</strong>: iedere AI-stap duurt dan ongeveer 1,5 seconde.</li>
              <li>Gebruik op de vragenschermen <strong>Demo-antwoorden invullen</strong>; laat bij één vraag zien hoe ‘laat de AI inschatten’ werkt.</li>
              <li>Typ zelf één zin in het voorstel en voeg een opmerking in de kantlijn toe — zo toon je de menselijke regie.</li>
              <li>Klik door de dashboardfilters en open ‘Cijfers uit het gesprek’: ieder getal is herleidbaar.</li>
              <li>Meld tijdens de demo één probleem via <strong>Probleem melden</strong> en open daarna <Link href="/evaluation">Evaluatie</Link> in een tweede tabblad.</li>
              <li>Ruim de demo-leads achteraf op; de opnamen blijven bewaard. Opnamen tellen nooit mee voor de evaluatie.</li>
            </>
          ) : (
            <>
              <li>If wifi or time is uncertain, choose <strong>Fast</strong>: each AI step then takes about 1.5 seconds.</li>
              <li>On the question screens, use <strong>Fill in demo answers</strong>; on one question, show how “let the AI estimate” works.</li>
              <li>Type one sentence yourself in the proposal and add one margin comment — that shows the human in the loop.</li>
              <li>Click through the dashboard filters and open “Figures from the call”: every number is traceable.</li>
              <li>Report one issue during the demo via <strong>Report an issue</strong>, then open <Link href="/evaluation">Evaluation</Link> in a second tab.</li>
              <li>Clean up the demo leads afterwards; recordings are kept. Recordings never count toward the evaluation.</li>
            </>
          )}
        </ul>
      </Card>
    </div>
  );
}
