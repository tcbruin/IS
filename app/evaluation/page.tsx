import Link from "next/link";
import type { ReactNode } from "react";
import { loadEvaluation } from "@/lib/evaluationData";
import { PRICING_SOURCE_URL, PRICING_VERIFIED_ON } from "@/lib/llmPricing";
import { Card } from "@/components/ui/Card";
import { StatusBlock } from "@/components/ui/StatusBlock";
import { SettingsForm } from "@/components/evaluation/SettingsForm";
import styles from "./page.module.css";
import { getLocale } from "@/lib/i18n-server";
import { pick, localeTag } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const STEP_NAMES: Record<string, string> = {
  questions1: "Clarifying questions",
  proposal: "Proposal",
  questions2: "Dashboard questions",
  dashboard: "Dashboard design",
  coverEmail: "Cover email",
  ping: "Connection test",
};

function Stat({ label, value, sub }: { label: string; value: string; sub?: ReactNode }) {
  return (
    <div className={styles.stat}>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValue}>{value}</div>
      {sub && <div className={styles.statSub}>{sub}</div>}
    </div>
  );
}

export default async function EvaluationPage({ searchParams }: { searchParams: Promise<{ demo?: string; mode?: string }> }) {
  const locale = await getLocale();
  const t = <T,>(english: T, dutch: T) => pick(locale, english, dutch);
  const num = (v: number | null | undefined, decimals = 0) => v == null || !Number.isFinite(v) ? "–" : v.toLocaleString(localeTag(locale), { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const eur = (v: number | null | undefined, decimals = 2) => v == null ? "–" : `€ ${num(v, decimals)}`;
  const pct = (v: number | null | undefined) => v == null ? "–" : `${num(v)}%`;
  const failureCategory = (value: string) => locale === "nl" ? ({
    "AI call failed": "AI-aanroep mislukt", "Invalid AI response, retried": "Ongeldig AI-antwoord, opnieuw geprobeerd",
    "Proposal length/readability": "Lengte/leesbaarheid voorstel", "Proposal warning": "Waarschuwing voorstel",
    "Guardrail: amount in investment": "Controle: bedrag in investering", "Guardrail: figure from the call not used": "Controle: cijfer uit gesprek niet gebruikt",
    "Invented fact": "Verzonnen feit", "Wrong scope": "Verkeerde scope", "Incorrect estimate": "Onjuiste schatting",
    "Tone/style": "Toon/stijl", "Incomplete": "Onvolledig", "Technical": "Technisch", "Other": "Overig",
  } as Record<string, string>)[value] ?? value : value;
  const stepNames: Record<string, string> = locale === "nl" ? {
    questions1: "Verduidelijkende vragen",
    proposal: "Voorstel",
    questions2: "Dashboardvragen",
    dashboard: "Dashboardontwerp",
    coverEmail: "Begeleidende e-mail",
    ping: "Verbindingstest",
  } : STEP_NAMES;
  const params = await searchParams;
  const includeDemo = params.demo === "1";
  const requestedMode = params.mode === "demo" || params.mode === "actual" ? params.mode : undefined;
  const { mode, metrics, summary: s, steps, settings } = await loadEvaluation({ includeDemo, mode: requestedMode });
  const isDemo = mode === "demo";
  const demoQuery = `&mode=${mode}${!isDemo && includeDemo ? "&demo=1" : ""}`;
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
            {t("Time, cost, quality and failures compared with the manual process. Choose illustrative demo results or actual measurements.", "Tijd, kosten, kwaliteit en fouten vergeleken met het handmatige proces. Kies illustratieve demoresultaten of echte metingen.")}
          </p>
        </div>
        <div className={styles.headerActions}>
          <Link href="/evaluation?mode=demo" className={styles.toggle} aria-current={isDemo ? "page" : undefined}>{t("Demo", "Demo")}</Link>
          <Link href={`/evaluation?mode=actual${includeDemo ? "&demo=1" : ""}`} className={styles.toggle} aria-current={!isDemo ? "page" : undefined}>{t("Actual results", "Echte resultaten")}</Link>
          {!isDemo && <Link href={includeDemo ? "/evaluation?mode=actual" : "/evaluation?mode=actual&demo=1"} className={styles.toggle}>
            {includeDemo ? t("✓ Live demos included", "✓ Live-demo's inbegrepen") : t("Include live demos", "Live-demo's meenemen")}
          </Link>}
          <a href={`/api/evaluation/export?type=leads${demoQuery}`} className={styles.csv}>
            {t("CSV per lead", "CSV per lead")}
          </a>
          <a href={`/api/evaluation/export?type=events${demoQuery}`} className={styles.csv}>
            {t("CSV all events", "CSV alle gebeurtenissen")}
          </a>
        </div>
      </header>

      {isDemo && <StatusBlock tone="neutral">{t("Illustrative demo data—not measured results. These six sample leads make no API calls and do not change your actual leads or settings.", "Illustratieve demodata—geen gemeten resultaten. Deze zes voorbeeldleads doen geen API-aanroepen en wijzigen je echte leads of instellingen niet.")}</StatusBlock>}
      <p className={styles.note}>
        {PRICING_VERIFIED_ON
          ? t(`AI price table verified on ${PRICING_VERIFIED_ON}.`, `AI-prijstabel gecontroleerd op ${PRICING_VERIFIED_ON}.`)
          : t("AI costs are estimates using an unverified price table, not invoiced charges.", "AI-kosten zijn schattingen met een ongecontroleerde prijstabel, geen gefactureerde bedragen.")}
        {" "}<a href={PRICING_SOURCE_URL} target="_blank" rel="noreferrer">{t("Official pricing source", "Officiële prijsbron")}</a>
      </p>
      {!s.pricingComplete && <StatusBlock tone="attention">{t("Some model prices are unavailable. Known AI spend is shown as a subtotal; totals and savings requiring missing prices are unavailable.", "Sommige modelprijzen zijn onbekend. Bekende AI-kosten staan als subtotaal; totalen en besparingen waarvoor prijzen ontbreken zijn niet beschikbaar.")}</StatusBlock>}

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
              {t("Basis", "Basis")}: {s.leadCount} {s.leadCount === 1 ? "lead" : "leads"}, {t("of which", "waarvan")} {s.completedCount} {t("sent. Time and cost medians use", "verzonden. Tijd- en kostenmedianen gebruiken")} {s.provisional ? t("all leads (provisional; none completed yet)", "alle leads (voorlopig; nog geen afgeronde leads)") : t("completed leads", "afgeronde leads")}.
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
              <Stat label={t("AI usage per lead", "AI-gebruik per lead")} value={eur(s.aiCostPerLead, 3)} sub={t("token-based estimate", "schatting op basis van tokens")} />
              <Stat label={t("All-lead AI spend", "AI-kosten alle leads")} value={eur(s.pricingComplete ? s.aiCostTotal : s.knownAiCostTotal, 3)} sub={s.pricingComplete ? t("includes failed calls and shortening calls", "inclusief mislukte en inkortingsaanroepen") : t("known subtotal; incomplete pricing", "bekend subtotaal; prijzen ontbreken")} />
              <Stat label={t("Manual baseline cost", "Handmatige referentiekosten")} value={eur(s.baselineCostPerLead)} sub={`${num(settings.baselineMinutesPerLead)} min × € ${num(settings.hourlyRateEur)}/${t("hour", "uur")}`} />
              <Stat label={t("Consultant time per lead", "Consultanttijd per lead")} value={eur(s.humanCostPerLead)} sub={t("active time × hourly rate", "actieve tijd × uurtarief")} />
              <Stat
                label={t("Total app cost per lead", "Totale appkosten per lead")}
                value={eur(s.costPerLeadWithApp)}
                sub={t("median of time + AI cost per lead", "mediaan van tijd + AI-kosten per lead")}
              />
              <Stat label={t("Savings per lead", "Besparing per lead")} value={eur(s.savingsEur)} sub={`${pct(s.savingsPct)} ${t("compared with manual baseline", "ten opzichte van handmatig")}`} />
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
                    <td className={styles.num}>{eur(st.pricingComplete ? st.costEur : st.knownCostEur, 3)}{!st.pricingComplete && ` (${t("subtotal", "subtotaal")})`}</td>
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
                  <th className={styles.num}>{t("Time cost", "Tijdkosten")}</th>
                  <th className={styles.num}>{t("Total cost", "Totale kosten")}</th>
                  <th className={styles.num}>{t("Savings", "Besparing")}</th>
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
                        {isDemo ? m.company : <Link href={`/leads/${m.leadId}`}>{m.company}</Link>}
                        {m.demo && <span className={styles.tag}>demo</span>}
                        {m.sent && <span className={styles.tagDone}>{t("sent", "verzonden")}</span>}
                      </td>
                      <td className={styles.num}>{num(m.activeMinutes)} min</td>
                      <td className={styles.num}>{num(m.throughputMinutes)} min</td>
                      <td className={styles.num}>{eur(m.aiCostEur, 3)}</td>
                      <td className={styles.num}>{eur(m.consultantCostEur)}</td>
                      <td className={styles.num}>{eur(m.totalCostEur)}</td>
                      <td className={styles.num}>{m.sent ? eur(m.savingsEur) : t("In progress", "In uitvoering")}</td>
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
                      <span className={styles.barLabel}>{failureCategory(category)}</span>
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
                        <td>{new Date(f.at).toLocaleString(localeTag(locale), { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Amsterdam" })}</td>
                        <td>{f.company}</td>
                        <td>{f.source === "manual" ? t("manual", "handmatig") : t("automatic", "automatisch")}</td>
                        <td>{stepNames[f.step] ?? f.step}</td>
                        <td>{failureCategory(f.category)}</td>
                        <td>{f.severity === "major" ? t("major", "ernstig") : t("minor", "klein")}</td>
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
          {isDemo ? <div className={styles.stats}>
            <Stat label={t("Manual baseline", "Handmatige nulmeting")} value={`${num(settings.baselineMinutesPerLead)} min`} />
            <Stat label={t("Hourly rate", "Uurtarief")} value={eur(settings.hourlyRateEur)} />
            <Stat label={t("USD → EUR assumption", "Aanname USD → EUR")} value={num(settings.usdToEur, 2)} />
          </div> : <SettingsForm settings={settings} />}
        </Card>
      </section>
    </div>
  );
}
