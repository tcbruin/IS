import Link from "next/link";
import { listLeads } from "@/lib/leadStore";
import { getRecordingStatus, listScenarios, RECORDED_STEPS } from "@/lib/demo";
import { PROMPT_VERSIONS } from "@/lib/llm";
import { Card } from "@/components/ui/Card";
import { CleanupButton, PingButton, StartDemoButton } from "@/components/demo/DemoControls";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

const STEP_NAMES: Record<string, string> = {
  questions1: "vragen",
  proposal: "voorstel",
  questions2: "dashboardvragen",
  dashboard: "dashboard",
  coverEmail: "e-mail",
};

/** Presenter page: pre-flight checks and one-click demo scenarios. */
export default async function DemoPage() {
  const [scenarios, leads] = await Promise.all([listScenarios(), listLeads()]);
  const statuses = await Promise.all(scenarios.map((s) => getRecordingStatus(s.id)));
  const demoLeads = leads.filter((l) => l.demo);
  const hasKey = Boolean(process.env.LLM_API_KEY ?? process.env.DEEPSEEK_API_KEY);

  return (
    <div className={styles.page}>
      <Link href="/" className={styles.back}>
        &larr; Alle leads
      </Link>
      <div>
        <h1 className={styles.title}>Demo</h1>
        <p className={styles.subtitle}>
          Voor presentaties. <strong>Snel</strong> speelt een eerder opgenomen AI-run af (±1,5 s per stap, geen internet
          nodig voor de AI). <strong>Live AI</strong> gebruikt de echte API — daarvan maak je ook een nieuwe opname.
        </p>
      </div>

      <Card>
        <h2 className={styles.h2}>Checklist vooraf</h2>
        <ul className={styles.checklist}>
          <li>
            <span className={hasKey ? styles.ok : styles.bad}>{hasKey ? "✓" : "✗"}</span> API-sleutel{" "}
            {hasKey ? "ingesteld" : "ontbreekt — alleen snelle demo's werken"}
          </li>
          <li className={styles.pingRow}>
            <PingButton />
          </li>
          {scenarios.map((s, i) => (
            <li key={s.id}>
              <span className={statuses[i].complete ? styles.ok : styles.warn}>{statuses[i].complete ? "✓" : "–"}</span> Opname{" "}
              {s.companyName}: {statuses[i].complete ? "compleet" : "nog niet (compleet)"}
            </li>
          ))}
          <li className={styles.cleanupRow}>
            <span>
              {demoLeads.length} demo-{demoLeads.length === 1 ? "lead" : "leads"} in de lijst
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
                    Opname van {new Date(status.meta.recordedAt).toLocaleDateString("nl-NL")} ({status.meta.model})
                    {outdated.length > 0 && (
                      <span className={styles.outdated}>
                        {" "}
                        · gemaakt met een oudere prompt voor {outdated.map(([step]) => STEP_NAMES[step] ?? step).join(", ")}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    Nog geen complete opname
                    {Object.values(status.steps).some(Boolean) &&
                      ` (wel: ${RECORDED_STEPS.filter((st) => status.steps[st]).map((st) => STEP_NAMES[st]).join(", ")})`}
                    . Start live, doorloop de demo en kies in het ⋯-menu “Opslaan als demo-opname”.
                  </>
                )}
              </p>
              <div className={styles.actions}>
                <StartDemoButton scenarioId={s.id} mode="replay" label="Start (snel)" disabled={!status.complete} />
                <StartDemoButton scenarioId={s.id} mode="live" label="Start (live AI)" variant="secondary" disabled={!hasKey} />
              </div>
            </Card>
          );
        })}
      </div>

      <Card variant="creme">
        <h2 className={styles.h2}>Tips voor de presentatie</h2>
        <ul className={styles.tips}>
          <li>Kies bij twijfel over wifi of tijd voor <strong>Snel</strong>: elke AI-stap duurt dan ±1,5 seconde.</li>
          <li>
            Gebruik op de vraagschermen <strong>Vul demo-antwoorden in</strong>; laat bij één vraag zien hoe “laat de AI
            inschatten” werkt.
          </li>
          <li>Typ in het voorstel één zin zelf en zet één opmerking in de kantlijn — dat laat de mens-in-de-lus zien.</li>
          <li>Klik op het dashboard door de filters en open “Cijfers uit het gesprek”: elk getal is herleidbaar.</li>
          <li>
            Meld tijdens de demo één fout via <strong>Meld een fout</strong> en open daarna{" "}
            <Link href="/evaluatie">Evaluatie</Link> in een tweede tab.
          </li>
          <li>Ruim na afloop de demo-leads op; opnames blijven bewaard. Opnames tellen nooit mee in de evaluatie.</li>
        </ul>
      </Card>
    </div>
  );
}
