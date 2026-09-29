import Link from "next/link";
import { listLeads } from "@/lib/leadStore";
import { getRecordingStatus, listScenarios, RECORDED_STEPS } from "@/lib/demo";
import { PROMPT_VERSIONS } from "@/lib/llm";
import { Card } from "@/components/ui/Card";
import { CleanupButton, PingButton, StartDemoButton } from "@/components/demo/DemoControls";
import styles from "./page.module.css";

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
  const [scenarios, leads] = await Promise.all([listScenarios(), listLeads()]);
  const statuses = await Promise.all(scenarios.map((s) => getRecordingStatus(s.id)));
  const demoLeads = leads.filter((l) => l.demo);
  const hasKey = Boolean(process.env.LLM_API_KEY ?? process.env.DEEPSEEK_API_KEY);

  return (
    <div className={styles.page}>
      <Link href="/" className={styles.back}>
        &larr; All leads
      </Link>
      <div>
        <h1 className={styles.title}>Demo</h1>
        <p className={styles.subtitle}>
          For presentations. <strong>Fast</strong> replays a previously recorded AI run (±1.5 s per step, no internet
          needed for the AI). <strong>Live AI</strong> uses the real API — that is also how you make a new recording.
        </p>
      </div>

      <Card>
        <h2 className={styles.h2}>Pre-flight checklist</h2>
        <ul className={styles.checklist}>
          <li>
            <span className={hasKey ? styles.ok : styles.bad}>{hasKey ? "✓" : "✗"}</span> API key{" "}
            {hasKey ? "configured" : "missing — only fast demos will work"}
          </li>
          <li className={styles.pingRow}>
            <PingButton />
          </li>
          {scenarios.map((s, i) => (
            <li key={s.id}>
              <span className={statuses[i].complete ? styles.ok : styles.warn}>{statuses[i].complete ? "✓" : "–"}</span> Recording{" "}
              {s.companyName}: {statuses[i].complete ? "complete" : "not (fully) recorded yet"}
            </li>
          ))}
          <li className={styles.cleanupRow}>
            <span>
              {demoLeads.length} demo {demoLeads.length === 1 ? "lead" : "leads"} in the list
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
                    Recorded on {new Date(status.meta.recordedAt).toLocaleDateString("en-GB")} ({status.meta.model})
                    {outdated.length > 0 && (
                      <span className={styles.outdated}>
                        {" "}
                        · made with an older prompt for {outdated.map(([step]) => STEP_NAMES[step] ?? step).join(", ")}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    No complete recording yet
                    {Object.values(status.steps).some(Boolean) &&
                      ` (available: ${RECORDED_STEPS.filter((st) => status.steps[st]).map((st) => STEP_NAMES[st]).join(", ")})`}
                    . Start live, run through the demo and choose “Save as demo recording” in the ⋯ menu.
                  </>
                )}
              </p>
              <div className={styles.actions}>
                <StartDemoButton scenarioId={s.id} mode="replay" label="Start (fast)" disabled={!status.complete} />
                <StartDemoButton scenarioId={s.id} mode="live" label="Start (live AI)" variant="secondary" disabled={!hasKey} />
              </div>
            </Card>
          );
        })}
      </div>

      <Card variant="creme">
        <h2 className={styles.h2}>Presentation tips</h2>
        <ul className={styles.tips}>
          <li>If wifi or time is uncertain, choose <strong>Fast</strong>: each AI step then takes about 1.5 seconds.</li>
          <li>
            On the question screens, use <strong>Fill in demo answers</strong>; on one question, show how “let the AI
            estimate” works.
          </li>
          <li>Type one sentence yourself in the proposal and add one margin comment — that shows the human in the loop.</li>
          <li>Click through the dashboard filters and open “Figures from the call”: every number is traceable.</li>
          <li>
            Report one issue during the demo via <strong>Report an issue</strong>, then open{" "}
            <Link href="/evaluation">Evaluation</Link> in a second tab.
          </li>
          <li>Clean up the demo leads afterwards; recordings are kept. Recordings never count toward the evaluation.</li>
        </ul>
      </Card>
    </div>
  );
}
