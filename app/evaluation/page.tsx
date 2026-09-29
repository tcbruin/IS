import Link from "next/link";
import type { ReactNode } from "react";
import { loadEvaluation } from "@/lib/evaluationData";
import { PRICING_VERIFIED_ON } from "@/lib/llmPricing";
import { Card } from "@/components/ui/Card";
import { StatusBlock } from "@/components/ui/StatusBlock";
import { SettingsForm } from "@/components/evaluation/SettingsForm";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

const STEP_NAMES: Record<string, string> = {
  questions1: "Clarifying questions",
  proposal: "Proposal",
  questions2: "Dashboard questions",
  dashboard: "Dashboard design",
  coverEmail: "Cover email",
  ping: "Connection test",
};

function num(v: number | null | undefined, decimals = 0): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "–";
  return v.toLocaleString("en-GB", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
const eur = (v: number | null | undefined, decimals = 2) => (v === null || v === undefined ? "–" : `€ ${num(v, decimals)}`);
const pct = (v: number | null | undefined) => (v === null || v === undefined ? "–" : `${num(v, 0)}%`);

function Stat({ label, value, sub }: { label: string; value: string; sub?: ReactNode }) {
  return (
    <div className={styles.stat}>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValue}>{value}</div>
      {sub && <div className={styles.statSub}>{sub}</div>}
    </div>
  );
}

export default async function EvaluationPage({ searchParams }: { searchParams: Promise<{ demo?: string }> }) {
  const includeDemo = (await searchParams).demo === "1";
  const { metrics, summary: s, steps, settings } = await loadEvaluation({ includeDemo });
  const demoQuery = includeDemo ? "&demo=1" : "";
  const maxMinutes = Math.max(settings.baselineMinutesPerLead, ...metrics.map((m) => m.activeMinutes), 1);
  const maxFailures = Math.max(1, ...s.failuresByCategory.map(([, n]) => n));

  return (
    <div className={styles.page}>
      <Link href="/" className={styles.back}>
        &larr; All leads
      </Link>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Evaluation</h1>
          <p className={styles.subtitle}>
            Time, cost, quality and failures of the app, compared with the manual process. Everything is measured
            automatically during use.
          </p>
        </div>
        <div className={styles.headerActions}>
          <Link href={includeDemo ? "/evaluation" : "/evaluation?demo=1"} className={styles.toggle}>
            {includeDemo ? "✓ Live demos included" : "Include live demos"}
          </Link>
          <a href={`/api/evaluation/export?type=leads${demoQuery}`} className={styles.csv}>
            CSV per lead
          </a>
          <a href={`/api/evaluation/export?type=events${demoQuery}`} className={styles.csv}>
            CSV all events
          </a>
        </div>
      </header>

      {!PRICING_VERIFIED_ON && (
        <StatusBlock tone="attention">
          AI costs are calculated with prices that have not been verified yet. Check the DeepSeek prices and set{" "}
          <code>PRICING_VERIFIED_ON</code> in <code>lib/llmPricing.ts</code> before using these figures in the report.
        </StatusBlock>
      )}

      {metrics.length === 0 ? (
        <Card>
          <p className={styles.empty}>
            No measured leads yet. From the first new lead on, everything is measured automatically: time per step, AI
            costs, answers, edits, scores and failures.
          </p>
        </Card>
      ) : (
        <>
          <section className={styles.section}>
            <h2 className={styles.h2}>Time and cost</h2>
            <p className={styles.note}>
              Basis: {s.leadCount} {s.leadCount === 1 ? "lead" : "leads"}, of which {s.completedCount} sent. Times are
              medians over {s.timeBasis}.
            </p>
            <div className={styles.stats}>
              <Stat
                label="Active time per lead"
                value={`${num(s.medianActiveMinutes)} min`}
                sub={
                  <>
                    manual {num(s.baselineMinutes)} min
                    {s.timeSavedPct !== null && (
                      <strong className={s.timeSavedPct >= 0 ? styles.good : styles.bad}> · {pct(s.timeSavedPct)} less</strong>
                    )}
                  </>
                }
              />
              <Stat label="Throughput time per lead" value={`${num(s.medianThroughputMinutes)} min`} sub="calendar time, incl. breaks" />
              <Stat label="AI wait time per lead" value={`${num(s.medianAiWaitMinutes, 1)} min`} sub="sum of all AI calls" />
              <Stat label="AI cost per lead" value={eur(s.aiCostPerLead, 3)} sub={`total ${eur(s.aiCostTotal, 2)}`} />
              <Stat
                label="Cost per lead"
                value={eur(s.costPerLeadWithApp, 0)}
                sub={`manual ${eur(s.baselineCostPerLead, 0)} · hourly rate € ${num(settings.hourlyRateEur)}`}
              />
              {s.medianOwnEstimate !== null && (
                <Stat label="Own estimate, manual" value={`${num(s.medianOwnEstimate)} min`} sub="median from the Retrospective" />
              )}
            </div>

            <div className={styles.chart}>
              <div className={styles.chartTitle}>Active minutes per lead vs. the manual baseline</div>
              {metrics.map((m) => (
                <div key={m.leadId} className={styles.barRow}>
                  <span className={styles.barLabel} title={m.company}>
                    {m.company}
                  </span>
                  <span className={styles.barTrack}>
                    <span className={styles.bar} style={{ width: `${(100 * m.activeMinutes) / maxMinutes}%` }} />
                    <span
                      className={styles.baseline}
                      style={{ left: `${(100 * settings.baselineMinutesPerLead) / maxMinutes}%` }}
                      title="Manual baseline"
                    />
                  </span>
                  <span className={styles.barValue}>{num(m.activeMinutes)} min</span>
                </div>
              ))}
              <div className={styles.legend}>
                <span className={styles.legendBar} /> with the app <span className={styles.legendLine} /> manual ({num(settings.baselineMinutesPerLead)} min)
              </div>
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.h2}>Quality</h2>
            <div className={styles.stats}>
              {(["questions", "proposal", "dashboard", "email"] as const).map((k) => (
                <Stat
                  key={k}
                  label={`Score ${{ questions: "questions", proposal: "proposal", dashboard: "dashboard", email: "email" }[k]}`}
                  value={s.ratings[k].mean === null ? "–" : `${num(s.ratings[k].mean, 1)} / 5`}
                  sub={`${s.ratings[k].n} ${s.ratings[k].n === 1 ? "rating" : "ratings"}`}
                />
              ))}
              <Stat
                label="Questions answered"
                value={pct(s.answeredPct)}
                sub={`${pct(s.estimatedPct)} estimated by AI · ${pct(s.blankPct)} blank`}
              />
              <Stat label="Feedback rounds" value={num(s.avgFeedbackRounds, 1)} sub="AI rounds with comments, average" />
              <Stat label="Manually edited" value={pct(s.avgManualEditPct)} sub="of the AI text, average" />
              <Stat label="AI right first time" value={pct(s.firstAttemptPct)} sub={`${s.aiCalls} AI calls`} />
            </div>

            <table className={styles.table}>
              <caption>Prompt versions of the clarifying questions (iteration)</caption>
              <thead>
                <tr>
                  <th>Version</th>
                  <th className={styles.num}>Leads</th>
                  <th className={styles.num}>Avg. question length</th>
                  <th className={styles.num}>Answered</th>
                  <th className={styles.num}>Estimated</th>
                  <th className={styles.num}>Blank</th>
                </tr>
              </thead>
              <tbody>
                {s.byPromptVersion.map((v) => (
                  <tr key={v.version}>
                    <td>{v.version}</td>
                    <td className={styles.num}>{v.leads}</td>
                    <td className={styles.num}>{v.avgQuestionChars === null ? "–" : `${num(v.avgQuestionChars)} chars`}</td>
                    <td className={styles.num}>{pct(v.answeredPct)}</td>
                    <td className={styles.num}>{pct(v.estimatedPct)}</td>
                    <td className={styles.num}>{pct(v.blankPct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className={styles.section}>
            <h2 className={styles.h2}>Per AI step</h2>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Step</th>
                  <th className={styles.num}>Calls</th>
                  <th className={styles.num}>Duration (median)</th>
                  <th className={styles.num}>Duration (p90)</th>
                  <th className={styles.num}>Tokens in / out</th>
                  <th className={styles.num}>Cost</th>
                  <th className={styles.num}>Retries</th>
                  <th className={styles.num}>Failed</th>
                </tr>
              </thead>
              <tbody>
                {steps.map((st) => (
                  <tr key={st.step}>
                    <td>{STEP_NAMES[st.step] ?? st.step}</td>
                    <td className={styles.num}>{st.calls}</td>
                    <td className={styles.num}>{num(st.medianSeconds, 1)} s</td>
                    <td className={styles.num}>{num(st.p90Seconds, 1)} s</td>
                    <td className={styles.num}>
                      {num(st.avgPromptTokens)} / {num(st.avgCompletionTokens)}
                    </td>
                    <td className={styles.num}>{eur(st.costEur, 3)}</td>
                    <td className={styles.num}>{st.retries}</td>
                    <td className={styles.num}>{st.failures}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className={styles.section}>
            <h2 className={styles.h2}>Per lead</h2>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Lead</th>
                  <th className={styles.num}>Active</th>
                  <th className={styles.num}>Throughput</th>
                  <th className={styles.num}>AI cost</th>
                  <th className={styles.num}>Feedback</th>
                  <th className={styles.num}>Manual</th>
                  <th className={styles.num}>Scores</th>
                  <th className={styles.num}>Failures</th>
                </tr>
              </thead>
              <tbody>
                {metrics.map((m) => {
                  const scores = Object.values(m.ratings);
                  return (
                    <tr key={m.leadId}>
                      <td>
                        <Link href={`/leads/${m.leadId}`}>{m.company}</Link>
                        {m.demo && <span className={styles.tag}>demo</span>}
                        {m.sent && <span className={styles.tagDone}>sent</span>}
                      </td>
                      <td className={styles.num}>{num(m.activeMinutes)} min</td>
                      <td className={styles.num}>{num(m.throughputMinutes)} min</td>
                      <td className={styles.num}>{eur(m.aiCostEur, 3)}</td>
                      <td className={styles.num}>{m.feedbackRounds}</td>
                      <td className={styles.num}>{m.manualEditPct === null ? "–" : pct(m.manualEditPct)}</td>
                      <td className={styles.num}>
                        {scores.length ? num(scores.reduce((a, b) => a + b, 0) / scores.length, 1) : "–"}
                      </td>
                      <td className={styles.num}>{m.failures.length}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <section className={styles.section}>
            <h2 className={styles.h2}>Failure log</h2>
            {s.failures.length === 0 ? (
              <p className={styles.note}>No failures reported or automatically detected yet.</p>
            ) : (
              <>
                <div className={styles.chart}>
                  {s.failuresByCategory.map(([category, n]) => (
                    <div key={category} className={styles.barRow}>
                      <span className={styles.barLabel}>{category}</span>
                      <span className={styles.barTrack}>
                        <span className={styles.barRed} style={{ width: `${(100 * n) / maxFailures}%` }} />
                      </span>
                      <span className={styles.barValue}>{n}</span>
                    </div>
                  ))}
                </div>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Lead</th>
                      <th>Source</th>
                      <th>Step</th>
                      <th>Category</th>
                      <th>Severity</th>
                      <th>Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.failures.slice(0, 50).map((f, i) => (
                      <tr key={i}>
                        <td>{new Date(f.at).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}</td>
                        <td>{f.company}</td>
                        <td>{f.source}</td>
                        <td>{STEP_NAMES[f.step] ?? f.step}</td>
                        <td>{f.category}</td>
                        <td>{f.severity}</td>
                        <td className={styles.noteCell}>{f.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </section>
        </>
      )}

      <section className={styles.section}>
        <h2 className={styles.h2}>Assumptions</h2>
        <p className={styles.note}>
          These assumptions drive the comparison; state them in the report. Current baseline: {settings.baselineSource}.
        </p>
        <Card>
          <SettingsForm settings={settings} />
        </Card>
      </section>
    </div>
  );
}
