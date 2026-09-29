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
  questions1: "Verduidelijkingsvragen",
  proposal: "Voorstel",
  questions2: "Dashboardvragen",
  dashboard: "Dashboardontwerp",
  coverEmail: "Begeleidende e-mail",
  ping: "Verbindingstest",
};

function num(v: number | null | undefined, decimals = 0): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "–";
  return v.toLocaleString("nl-NL", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
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
        &larr; Alle leads
      </Link>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Evaluatie</h1>
          <p className={styles.subtitle}>
            Tijd, kosten, kwaliteit en fouten van de app, vergeleken met de handmatige werkwijze. Alles wordt automatisch
            gemeten tijdens het gebruik.
          </p>
        </div>
        <div className={styles.headerActions}>
          <Link href={includeDemo ? "/evaluatie" : "/evaluatie?demo=1"} className={styles.toggle}>
            {includeDemo ? "✓ Live demo's meegeteld" : "Live demo's meetellen"}
          </Link>
          <a href={`/api/evaluatie/export?type=leads${demoQuery}`} className={styles.csv}>
            CSV per lead
          </a>
          <a href={`/api/evaluatie/export?type=events${demoQuery}`} className={styles.csv}>
            CSV alle metingen
          </a>
        </div>
      </header>

      {!PRICING_VERIFIED_ON && (
        <StatusBlock tone="attention">
          AI-kosten zijn berekend met prijzen die nog niet zijn gecontroleerd. Controleer de DeepSeek-prijzen en zet{" "}
          <code>PRICING_VERIFIED_ON</code> in <code>lib/llmPricing.ts</code> voordat je deze cijfers in het verslag gebruikt.
        </StatusBlock>
      )}

      {metrics.length === 0 ? (
        <Card>
          <p className={styles.empty}>
            Nog geen gemeten leads. Vanaf de eerste nieuwe lead wordt alles automatisch gemeten: tijd per stap, AI-kosten,
            antwoorden, bewerkingen, scores en fouten.
          </p>
        </Card>
      ) : (
        <>
          <section className={styles.section}>
            <h2 className={styles.h2}>Tijd en kosten</h2>
            <p className={styles.note}>
              Basis: {s.leadCount} {s.leadCount === 1 ? "lead" : "leads"}, waarvan {s.completedCount} verzonden. Tijden zijn
              medianen over {s.timeBasis}.
            </p>
            <div className={styles.stats}>
              <Stat
                label="Actieve tijd per lead"
                value={`${num(s.medianActiveMinutes)} min`}
                sub={
                  <>
                    handmatig {num(s.baselineMinutes)} min
                    {s.timeSavedPct !== null && (
                      <strong className={s.timeSavedPct >= 0 ? styles.good : styles.bad}> · {pct(s.timeSavedPct)} minder</strong>
                    )}
                  </>
                }
              />
              <Stat label="Doorlooptijd per lead" value={`${num(s.medianThroughputMinutes)} min`} sub="kalendertijd, incl. pauzes" />
              <Stat label="AI-wachttijd per lead" value={`${num(s.medianAiWaitMinutes, 1)} min`} sub="som van alle AI-aanroepen" />
              <Stat label="AI-kosten per lead" value={eur(s.aiCostPerLead, 3)} sub={`totaal ${eur(s.aiCostTotal, 2)}`} />
              <Stat
                label="Kosten per lead"
                value={eur(s.costPerLeadWithApp, 0)}
                sub={`handmatig ${eur(s.baselineCostPerLead, 0)} · uurtarief € ${num(settings.hourlyRateEur)}`}
              />
              {s.medianOwnEstimate !== null && (
                <Stat label="Eigen schatting handmatig" value={`${num(s.medianOwnEstimate)} min`} sub="mediaan van de Terugblik" />
              )}
            </div>

            <div className={styles.chart}>
              <div className={styles.chartTitle}>Actieve minuten per lead t.o.v. de handmatige baseline</div>
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
                      title="Handmatige baseline"
                    />
                  </span>
                  <span className={styles.barValue}>{num(m.activeMinutes)} min</span>
                </div>
              ))}
              <div className={styles.legend}>
                <span className={styles.legendBar} /> met de app <span className={styles.legendLine} /> handmatig ({num(settings.baselineMinutesPerLead)} min)
              </div>
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.h2}>Kwaliteit</h2>
            <div className={styles.stats}>
              {(["questions", "proposal", "dashboard", "email"] as const).map((k) => (
                <Stat
                  key={k}
                  label={`Score ${{ questions: "vragen", proposal: "voorstel", dashboard: "dashboard", email: "e-mail" }[k]}`}
                  value={s.ratings[k].mean === null ? "–" : `${num(s.ratings[k].mean, 1)} / 5`}
                  sub={`${s.ratings[k].n} ${s.ratings[k].n === 1 ? "beoordeling" : "beoordelingen"}`}
                />
              ))}
              <Stat
                label="Vragen beantwoord"
                value={pct(s.answeredPct)}
                sub={`${pct(s.estimatedPct)} door AI ingeschat · ${pct(s.blankPct)} leeg`}
              />
              <Stat label="Feedbackrondes" value={num(s.avgFeedbackRounds, 1)} sub="AI-rondes met opmerkingen, gemiddeld" />
              <Stat label="Handmatig gewijzigd" value={pct(s.avgManualEditPct)} sub="van de AI-tekst, gemiddeld" />
              <Stat label="AI in één keer goed" value={pct(s.firstAttemptPct)} sub={`${s.aiCalls} AI-aanroepen`} />
            </div>

            <table className={styles.table}>
              <caption>Promptversies van de verduidelijkingsvragen (iteratie)</caption>
              <thead>
                <tr>
                  <th>Versie</th>
                  <th className={styles.num}>Leads</th>
                  <th className={styles.num}>Gem. vraaglengte</th>
                  <th className={styles.num}>Beantwoord</th>
                  <th className={styles.num}>Ingeschat</th>
                  <th className={styles.num}>Leeg</th>
                </tr>
              </thead>
              <tbody>
                {s.byPromptVersion.map((v) => (
                  <tr key={v.version}>
                    <td>{v.version}</td>
                    <td className={styles.num}>{v.leads}</td>
                    <td className={styles.num}>{v.avgQuestionChars === null ? "–" : `${num(v.avgQuestionChars)} tekens`}</td>
                    <td className={styles.num}>{pct(v.answeredPct)}</td>
                    <td className={styles.num}>{pct(v.estimatedPct)}</td>
                    <td className={styles.num}>{pct(v.blankPct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className={styles.section}>
            <h2 className={styles.h2}>Per AI-stap</h2>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Stap</th>
                  <th className={styles.num}>Aanroepen</th>
                  <th className={styles.num}>Duur (mediaan)</th>
                  <th className={styles.num}>Duur (p90)</th>
                  <th className={styles.num}>Tokens in / uit</th>
                  <th className={styles.num}>Kosten</th>
                  <th className={styles.num}>Opnieuw</th>
                  <th className={styles.num}>Mislukt</th>
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
                  <th className={styles.num}>Actief</th>
                  <th className={styles.num}>Doorloop</th>
                  <th className={styles.num}>AI-kosten</th>
                  <th className={styles.num}>Feedback</th>
                  <th className={styles.num}>Handmatig</th>
                  <th className={styles.num}>Scores</th>
                  <th className={styles.num}>Fouten</th>
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
                        {m.sent && <span className={styles.tagDone}>verzonden</span>}
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
            <h2 className={styles.h2}>Foutenlog</h2>
            {s.failures.length === 0 ? (
              <p className={styles.note}>Nog geen fouten gemeld of automatisch gedetecteerd.</p>
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
                      <th>Wanneer</th>
                      <th>Lead</th>
                      <th>Bron</th>
                      <th>Stap</th>
                      <th>Categorie</th>
                      <th>Ernst</th>
                      <th>Toelichting</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.failures.slice(0, 50).map((f, i) => (
                      <tr key={i}>
                        <td>{new Date(f.at).toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "short" })}</td>
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
        <h2 className={styles.h2}>Aannames</h2>
        <p className={styles.note}>
          Deze aannames bepalen de vergelijking; noem ze in het verslag. Huidige baseline: {settings.baselineSource}.
        </p>
        <Card>
          <SettingsForm settings={settings} />
        </Card>
      </section>
    </div>
  );
}
