import { NextResponse } from "next/server";
import { loadEvaluation } from "@/lib/evaluationData";
import { toCsv } from "@/lib/evaluation";
import { STATE_LABELS } from "@/lib/workflow";
import { llmCostUsd } from "@/lib/llmPricing";
import { handleApiError } from "@/lib/apiError";

/** GET ?type=leads|events[&demo=1] — CSV for Excel (semicolon, decimal comma, BOM). */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const type = url.searchParams.get("type") === "events" ? "events" : "leads";
    const { rows, metrics, settings } = await loadEvaluation({ includeDemo: url.searchParams.get("demo") === "1" });

    const records =
      type === "leads"
        ? metrics.map((m) => {
            const lead = rows.find((r) => r.lead.id === m.leadId)!.lead;
            return {
              lead_id: m.leadId,
              bedrijf: m.company,
              status: STATE_LABELS[lead.state],
              demo: m.demo ? "ja" : "nee",
              verzonden: m.sent ? "ja" : "nee",
              gestart: m.firstAt,
              actieve_minuten: m.activeMinutes,
              doorlooptijd_minuten: m.throughputMinutes,
              ai_wachttijd_minuten: m.aiWaitMinutes,
              baseline_minuten: settings.baselineMinutesPerLead,
              eigen_schatting_handmatig_minuten: m.baselineEstimate,
              ai_aanroepen: m.aiCalls,
              ai_kosten_eur: m.aiCostEur,
              feedbackrondes: m.feedbackRounds,
              handmatige_versies: m.manualVersions,
              handmatig_gewijzigd_pct: m.manualEditPct,
              vragen_beantwoord: m.answered,
              vragen_ingeschat: m.estimated,
              vragen_leeg: m.blank,
              promptversie_vragen: m.q1PromptVersion,
              score_vragen: m.ratings.questions,
              score_voorstel: m.ratings.proposal,
              score_dashboard: m.ratings.dashboard,
              score_email: m.ratings.email,
              fouten_handmatig: m.failures.filter((f) => f.source === "handmatig").length,
              fouten_automatisch: m.failures.filter((f) => f.source === "automatisch").length,
            };
          })
        : rows.flatMap(({ lead, events }) =>
            events.map((e) => {
              const { v: _v, at, type: eventType, ...rest } = e;
              const extra: Record<string, unknown> = {};
              for (const [k, val] of Object.entries(rest)) extra[k] = Array.isArray(val) ? val.join(",") : val;
              if (e.type === "llm_call") {
                const usd = llmCostUsd(e);
                extra.kosten_eur = usd === null ? null : usd * settings.usdToEur;
              }
              return { lead_id: lead.id, bedrijf: lead.companyName, tijdstip: at, type: eventType, ...extra };
            }),
          );

    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(toCsv(records), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="evaluatie-${type}-${date}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
