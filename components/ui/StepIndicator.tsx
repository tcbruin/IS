import Link from "next/link";
import { STEPS, getStepHref, getStepStatus, type StepKey } from "@/lib/workflow";
import type { LeadState } from "@/lib/validation";
import styles from "./StepIndicator.module.css";

/** The 4-step bar. Done/active/future comes from the lead's state; the orange ring marks the
 * step whose page is being viewed (may differ from the active step when looking back). Reached
 * steps link to their page — steps stay editable after the fact (human feedback loop). */
export function StepIndicator({
  state,
  leadId,
  viewed,
  interactive = true,
  size = "default",
}: {
  state: LeadState;
  leadId: string;
  viewed?: StepKey | null;
  interactive?: boolean;
  size?: "default" | "compact";
}) {
  return (
    <ol className={[styles.row, size === "compact" ? styles.compact : ""].join(" ")}>
      {STEPS.map((step) => {
        const status = getStepStatus(step, state);
        const linkable = interactive && status !== "future";
        const inner = (
          <>
            <span className={styles.node}>{status === "done" ? "✓" : step.number}</span>
            {size === "default" && <span className={styles.label}>{step.label}</span>}
          </>
        );
        return (
          <li
            key={step.key}
            className={[styles.item, styles[status], viewed === step.key ? styles.viewed : ""].join(" ")}
            title={step.description}
            aria-current={viewed === step.key ? "step" : undefined}
          >
            {linkable ? (
              <Link href={getStepHref(leadId, step, state)} className={styles.itemInner}>
                {inner}
              </Link>
            ) : (
              <span className={styles.itemInner}>{inner}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
