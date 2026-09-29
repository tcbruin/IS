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
              company: m.company,
              status: STATE_LABELS[lead.state],
              demo: m.demo ? "yes" : "no",
              sent: m.sent ? "yes" : "no",
              started_at: m.firstAt,
              active_minutes: m.activeMinutes,
              throughput_minutes: m.throughputMinutes,
              ai_wait_minutes: m.aiWaitMinutes,
              baseline_minutes: settings.baselineMinutesPerLead,
              own_estimate_manual_minutes: m.baselineEstimate,
              ai_calls: m.aiCalls,
              ai_cost_eur: m.aiCostEur,
              feedback_rounds: m.feedbackRounds,
              manual_versions: m.manualVersions,
              manual_edit_pct: m.manualEditPct,
              questions_answered: m.answered,
              questions_estimated: m.estimated,
              questions_blank: m.blank,
              questions_prompt_version: m.q1PromptVersion,
              score_questions: m.ratings.questions,
              score_proposal: m.ratings.proposal,
              score_dashboard: m.ratings.dashboard,
              score_email: m.ratings.email,
              failures_manual: m.failures.filter((f) => f.source === "manual").length,
              failures_automatic: m.failures.filter((f) => f.source === "automatic").length,
            };
          })
        : rows.flatMap(({ lead, events }) =>
            events.map((e) => {
              const { v: _v, at, type: eventType, ...rest } = e;
              const extra: Record<string, unknown> = {};
              for (const [k, val] of Object.entries(rest)) extra[k] = Array.isArray(val) ? val.join(",") : val;
              if (e.type === "llm_call") {
                const usd = llmCostUsd(e);
                extra.cost_eur = usd === null ? null : usd * settings.usdToEur;
              }
              return { lead_id: lead.id, company: lead.companyName, timestamp: at, type: eventType, ...extra };
            }),
          );

    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(toCsv(records), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="evaluation-${type}-${date}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
