import Link from "next/link";
import styles from "./AIContextPanel.module.css";

export interface AIContextInputItem {
  label: string;
  present: boolean;
  /** Shown after the label when present, e.g. a value, an excerpt, or a count. */
  detail?: string;
  /** Shown instead of a generic "not available" line when !present. */
  absentText?: string;
  /** Optional "View ..." link, only rendered when present. */
  href?: string;
  linkLabel?: string;
}

/** Transparency at each AI step: what the AI based this on and which rules it follows.
 * Collapsed by default (native <details>) so it never competes with the task on screen, but
 * always in the same spot and one click away — the summary line itself already says how many
 * sources and rules there are. */
export function AIContextPanel({
  inputs,
  principles,
}: {
  inputs: AIContextInputItem[];
  principles: string[];
}) {
  const sourceCount = inputs.filter((i) => i.present).length;
  return (
    <details className={["no-print", styles.panel].join(" ")}>
      <summary className={styles.summary}>
        <span className={styles.summaryTitle}>What is this based on?</span>
        <span className={styles.summaryMeta}>
          {sourceCount} {sourceCount === 1 ? "source" : "sources"} · {principles.length}{" "}
          {principles.length === 1 ? "rule" : "rules"}
        </span>
      </summary>

      <div className={styles.body}>
        <div>
          <div className={styles.groupLabel}>Based on</div>
          <ul className={styles.inputList}>
            {inputs.map((item) => (
              <li key={item.label} className={styles.inputRow}>
                <span aria-hidden="true" className={item.present ? styles.iconYes : styles.iconNo}>
                  {item.present ? "✓" : "—"}
                </span>
                <span>
                  <span className={styles.inputLabel}>{item.label}</span>
                  {item.present && item.detail && <span className={styles.detail}> — {item.detail}</span>}
                  {!item.present && item.absentText && <span className={styles.absent}> — {item.absentText}</span>}
                  {item.present && item.href && (
                    <>
                      {" "}
                      <Link href={item.href} className={styles.link}>
                        {item.linkLabel ?? "View"}
                      </Link>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className={styles.groupLabel}>Rules the AI follows</div>
          <ul className={styles.principleList}>
            {principles.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      </div>
    </details>
  );
}
