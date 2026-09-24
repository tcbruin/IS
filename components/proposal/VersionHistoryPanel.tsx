import Link from "next/link";
import type { ProposalVersion } from "@/lib/validation";
import { Chip } from "@/components/ui/Chip";
import styles from "./VersionHistoryPanel.module.css";

function describeVersion(v: ProposalVersion): string {
  if (v.source === "manual") {
    const pct = v.editStats?.changedPct;
    return `Handmatig bewerkt${pct !== undefined ? ` · ${pct.toLocaleString("nl-NL")}% gewijzigd` : ""}`;
  }
  return v.feedback ? "AI · met feedback" : "AI · eerste concept";
}

/** Every save and every AI round is an immutable version; collapsed by default. */
export function VersionHistoryPanel({
  leadId,
  versions,
  activeVersion,
  finalVersion,
}: {
  leadId: string;
  versions: ProposalVersion[];
  activeVersion: number;
  finalVersion: number | null;
}) {
  return (
    <details className={["no-print", styles.panel].join(" ")}>
      <summary className={styles.summary}>
        <span className={styles.summaryTitle}>Versiegeschiedenis</span>
        <span className={styles.summaryMeta}>
          {versions.length} {versions.length === 1 ? "versie" : "versies"}
        </span>
      </summary>
      <div className={styles.list}>
        {[...versions].reverse().map((v) => (
          <div key={v.version} className={styles.row}>
            <div>
              <Link
                href={`/leads/${leadId}/proposal?version=${v.version}`}
                className={v.version === activeVersion ? styles.active : undefined}
              >
                <span className={styles.versionLabel}>v{v.version}</span> · {describeVersion(v)}
              </Link>
              <div className={styles.date}>{new Date(v.createdAt).toLocaleString("nl-NL")}</div>
              {v.feedback && <div className={styles.feedback}>{v.feedback}</div>}
            </div>
            {v.version === finalVersion && <Chip>Definitief</Chip>}
          </div>
        ))}
      </div>
    </details>
  );
}
