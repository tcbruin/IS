import Link from "next/link";
import type { ReactNode } from "react";
import { loadEvaluation } from "@/lib/evaluationData";
import { PRICING_VERIFIED_ON } from "@/lib/llmPricing";
import { Card } from "@/components/ui/Card";
import { StatusBlock } from "@/components/ui/StatusBlock";
import { SettingsForm } from "@/components/evaluation/SettingsForm";
import styles from "./page.module.css";
import { getLocale } from "@/lib/i18n-server";
import { pick } from "@/lib/i18n";

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
  const locale = await getLocale();
  const t = <T,>(english: T, dutch: T) => pick(locale, english, dutch);
  const stepNames: Record<string, string> = locale === "nl" ? {
    questions1: "Verduidelijkende vragen",
    proposal: "Voorstel",
    questions2: "Dashboardvragen",
    dashboard: "Dashboardontwerp",
    coverEmail: "Begeleidende e-mail",
    ping: "Verbindingstest",
  } : STEP_NAMES;
  const includeDemo = (await searchParams).demo === "1";
  const { metrics, summary: s, steps, settings } = await loadEvaluation({ includeDemo });
  const demoQuery = includeDemo ? "&demo=1" : "";
  const maxMinutes = Math.max(settings.baselineMinutesPerLead, ...metrics.map((m) => m.activeMinutes), 1);
  const maxFailures = Math.max(1, ...s.failuresByCategory.map(([, n]) => n));

  return (
    <div className={styles.page}>
      <Link href="/" className={styles.back}>
        &larr; {t("All leads", "Alle leads")}
      </Link>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{t("Evaluation", "Evaluatie")}</h1>
          <p className={styles.subtitle}>
            {t("Time, cost, quality and failures of the app, compared with the manual process. Everything is measured automatically during use.", "Tijd, kosten, kwaliteit en fouten van de app, vergeleken met het handmatige proces. Alles wordt tijdens het gebruik automatisch gemeten.")}
          </p>
        </div>
        <div className={styles.headerActions}>
          <Link href={includeDemo ? "/evaluation" : "/evaluation?demo=1"} className={styles.toggle}>
            {includeDemo ? t("✓ Live demos included", "✓ Live-demo's inbegrepen") : t("Include live demos", "Live-demo's meenemen")}
          </Link>
          <a href={`/api/evaluation/export?type=leads${demoQuery}`} className={styles.csv}>
            {t("CSV per lead", "CSV per lead")}
          </a>
          <a href={`/api/evaluation/export?type=events${demoQuery}`} className={styles.csv}>
            {t("CSV all events", "CSV alle gebeurtenissen")}
          </a>
        </div>
      </header>

      {!PRICING_VERIFIED_ON && (
        <StatusBlock tone="attention">
          {t("AI costs are calculated with prices that have not been verified yet. Check the DeepSeek prices and set", "AI-kosten zijn berekend met prijzen die nog niet zijn gecontroleerd. Controleer de DeepSeek-prijzen en stel")} {" "}
          <code>PRICING_VERIFIED_ON</code> {t("in", "in")} <code>lib/llmPricing.ts</code> {t("before using these figures in the report.", "in voordat je deze cijfers in het rapport gebruikt.")}
        </StatusBlock>
      )}

      {metrics.length === 0 ? (
        <Card>
          <p className={styles.empty}>
            {t("No measured leads yet. From the first new lead on, everything is measured automatically: time per step, AI costs, answers, edits, scores and failures.", "Nog geen gemeten leads. Vanaf de eerste nieuwe lead wordt alles automatisch gemeten: tijd per stap, AI-kosten, antwoorden, bewerkingen, scores en fouten.")}
          </p>
        </Card>
      ) : (
        <>
          <section className={styles.section}>
            <h2 className={styles.h2}>{t("Time and cost", "Tijd en kosten")}</h2>
            <p className={styles.note}>
              {t("Basis", "Basis")}: {s.leadCount} {s.leadCount === 1 ? "lead" : "leads"}, {t("of which", "waarvan")} {s.completedCount} {t("sent. Times are medians over", "verzonden. Tijden zijn medianen over")} {s.timeBasis}.
            </p>
            <div className={styles.stats}>
              <Stat
                label={t("Active time per lead", "Actieve tijd per lead")}
                value={`${num(s.medianActiveMinutes)} min`}
                sub={
                  <>
                    {t("manual", "handmatig")} {num(s.baselineMinutes)} min
                    {s.timeSavedPct !== null && (
                      <strong className={s.timeSavedPct >= 0 ? styles.good : styles.bad}> · {pct(s.timeSavedPct)} {t("less", "minder")}</strong>
                    )}
                  </>
                }
              />
              <Stat label={t("Throughput time per lead", "Doorlooptijd per lead")} value={`${num(s.medianThroughputMinutes)} min`} sub={t("calendar time, incl. breaks", "kalendertijd, incl. onderbrekingen")} />
              <Stat label={t("AI wait time per lead", "AI-wachttijd per lead")} value={`${num(s.medianAiWaitMinutes, 1)} min`} sub={t("sum of all AI calls", "som van alle AI-aanroepen")} />
              <Stat label={t("AI cost per lead", "AI-kosten per lead")} value={eur(s.aiCostPerLead, 3)} sub={`${t("total", "totaal")} ${eur(s.aiCostTotal, 2)}`} />
              <Stat
                label={t("Cost per lead", "Kosten per lead")}
                value={eur(s.costPerLeadWithApp, 0)}
                sub={`${t("manual", "handmatig")} ${eur(s.baselineCostPerLead, 0)} · ${t("hourly rate", "uurtarief")} € ${num(settings.hourlyRateEur)}`}
              />
              {s.medianOwnEstimate !== null && (
                <Stat label={t("Own estimate, manual", "Eigen inschatting, handmatig")} value={`${num(s.medianOwnEstimate)} min`} sub={t("median from the Retrospective", "mediaan uit de terugblik")} />
              )}
            </div>

            <div className={styles.chart}>
              <div className={styles.chartTitle}>{t("Active minutes per lead vs. the manual baseline", "Actieve minuten per lead tegenover de handmatige nulmeting")}</div>
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
                      title={t("Manual baseline", "Handmatige nulmeting")}
                    />
                  </span>
                  <span className={styles.barValue}>{num(m.activeMinutes)} min</span>
                </div>
              ))}
              <div className={styles.legend}>
                <span className={styles.legendBar} /> {t("with the app", "met de app")} <span className={styles.legendLine} /> {t("manual", "handmatig")} ({num(settings.baselineMinutesPerLead)} min)
              </div>
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.h2}>{t("Quality", "Kwaliteit")}</h2>
            <div className={styles.stats}>
              {(["questions", "proposal", "dashboard", "email"] as const).map((k) => (
                <Stat
                  key={k}
                  label={`${t("Score", "Score")} ${{ questions: t("questions", "vragen"), proposal: t("proposal", "voorstel"), dashboard: "dashboard", email: "e-mail" }[k]}`}
                  value={s.ratings[k].mean === null ? "–" : `${num(s.ratings[k].mean, 1)} / 5`}
                  sub={`${s.ratings[k].n} ${s.ratings[k].n === 1 ? t("rating", "beoordeling") : t("ratings", "beoordelingen")}`}
                />
              ))}
              <Stat
                label={t("Questions answered", "Vragen beantwoord")}
                value={pct(s.answeredPct)}
                sub={`${pct(s.estimatedPct)} ${t("estimated by AI", "ingeschat door AI")} · ${pct(s.blankPct)} ${t("blank", "leeg")}`}
              />
              <Stat label={t("Feedback rounds", "Feedbackrondes")} value={num(s.avgFeedbackRounds, 1)} sub={t("AI rounds with comments, average", "AI-rondes met opmerkingen, gemiddeld")} />
              <Stat label={t("Manually edited", "Handmatig bewerkt")} value={pct(s.avgManualEditPct)} sub={t("of the AI text, average", "van de AI-tekst, gemiddeld")} />
              <Stat label={t("AI right first time", "AI direct goed")} value={pct(s.firstAttemptPct)} sub={`${s.aiCalls} ${t("AI calls", "AI-aanroepen")}`} />
            </div>

            <table className={styles.table}>
              <caption>{t("Prompt versions of the clarifying questions (iteration)", "Promptversies van de verduidelijkende vragen (iteratie)")}</caption>
              <thead>
                <tr>
                  <th>{t("Version", "Versie")}</th>
                  <th className={styles.num}>Leads</th>
                  <th className={styles.num}>{t("Avg. question length", "Gem. vraaglengte")}</th>
                  <th className={styles.num}>{t("Answered", "Beantwoord")}</th>
                  <th className={styles.num}>{t("Estimated", "Ingeschat")}</th>
                  <th className={styles.num}>{t("Blank", "Leeg")}</th>
                </tr>
              </thead>
              <tbody>
                {s.byPromptVersion.map((v) => (
                  <tr key={v.version}>
                    <td>{v.version}</td>
                    <td className={styles.num}>{v.leads}</td>
                    <td className={styles.num}>{v.avgQuestionChars === null ? "–" : `${num(v.avgQuestionChars)} ${t("chars", "tekens")}`}</td>
                    <td className={styles.num}>{pct(v.answeredPct)}</td>
                    <td className={styles.num}>{pct(v.estimatedPct)}</td>
                    <td className={styles.num}>{pct(v.blankPct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className={styles.section}>
            <h2 className={styles.h2}>{t("Per AI step", "Per AI-stap")}</h2>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t("Step", "Stap")}</th>
                  <th className={styles.num}>{t("Calls", "Aanroepen")}</th>
                  <th className={styles.num}>{t("Duration (median)", "Duur (mediaan)")}</th>
                  <th className={styles.num}>{t("Duration (p90)", "Duur (p90)")}</th>
                  <th className={styles.num}>{t("Tokens in / out", "Tokens in / uit")}</th>
                  <th className={styles.num}>{t("Cost", "Kosten")}</th>
                  <th className={styles.num}>{t("Retries", "Nieuwe pogingen")}</th>
                  <th className={styles.num}>{t("Failed", "Mislukt")}</th>
                </tr>
              </thead>
              <tbody>
                {steps.map((st) => (
                  <tr key={st.step}>
                    <td>{stepNames[st.step] ?? st.step}</td>
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
            <h2 className={styles.h2}>{t("Per lead", "Per lead")}</h2>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Lead</th>
                  <th className={styles.num}>{t("Active", "Actief")}</th>
                  <th className={styles.num}>{t("Throughput", "Doorlooptijd")}</th>
                  <th className={styles.num}>{t("AI cost", "AI-kosten")}</th>
                  <th className={styles.num}>Feedback</th>
                  <th className={styles.num}>{t("Manual", "Handmatig")}</th>
                  <th className={styles.num}>Scores</th>
                  <th className={styles.num}>{t("Failures", "Fouten")}</th>
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
                        {m.sent && <span className={styles.tagDone}>{t("sent", "verzonden")}</span>}
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
            <h2 className={styles.h2}>{t("Failure log", "Foutenlogboek")}</h2>
            {s.failures.length === 0 ? (
              <p className={styles.note}>{t("No failures reported or automatically detected yet.", "Nog geen fouten gemeld of automatisch gedetecteerd.")}</p>
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
                      <th>{t("When", "Wanneer")}</th>
                      <th>Lead</th>
                      <th>{t("Source", "Bron")}</th>
                      <th>{t("Step", "Stap")}</th>
                      <th>{t("Category", "Categorie")}</th>
                      <th>{t("Severity", "Ernst")}</th>
                      <th>{t("Note", "Notitie")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.failures.slice(0, 50).map((f, i) => (
                      <tr key={i}>
                        <td>{new Date(f.at).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}</td>
                        <td>{f.company}</td>
                        <td>{f.source}</td>
                        <td>{stepNames[f.step] ?? f.step}</td>
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
        <h2 className={styles.h2}>{t("Assumptions", "Aannames")}</h2>
        <p className={styles.note}>
          {t("These assumptions drive the comparison; state them in the report. Current baseline:", "Deze aannames sturen de vergelijking; neem ze op in het rapport. Huidige nulmeting:")} {settings.baselineSource}.
        </p>
        <Card>
          <SettingsForm settings={settings} />
        </Card>
      </section>
    </div>
  );
}
