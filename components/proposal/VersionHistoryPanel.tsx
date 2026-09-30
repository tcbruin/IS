"use client";

import Link from "next/link";
import type { ProposalVersion } from "@/lib/validation";
import { Chip } from "@/components/ui/Chip";
import styles from "./VersionHistoryPanel.module.css";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import { localeTag, type Locale } from "@/lib/i18n";

function describeVersion(v: ProposalVersion, locale: Locale): string {
  if (v.source === "manual") {
    const pct = v.editStats?.changedPct;
    return locale === "nl"
      ? `Handmatig bewerkt${pct !== undefined ? ` · ${pct.toLocaleString(localeTag(locale))}% gewijzigd` : ""}`
      : `Edited manually${pct !== undefined ? ` · ${pct.toLocaleString(localeTag(locale))}% changed` : ""}`;
  }
  return v.feedback ? (locale === "nl" ? "AI · met feedback" : "AI · with feedback") : (locale === "nl" ? "AI · eerste concept" : "AI · first draft");
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
  const { locale, text } = useLanguage();
  return (
    <details className={["no-print", styles.panel].join(" ")}>
      <summary className={styles.summary}>
        <span className={styles.summaryTitle}>{text("Version history", "Versiegeschiedenis")}</span>
        <span className={styles.summaryMeta}>
          {versions.length} {versions.length === 1 ? text("version", "versie") : text("versions", "versies")}
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
                <span className={styles.versionLabel}>v{v.version}</span> · {describeVersion(v, locale)}
              </Link>
              <div className={styles.date}>{new Date(v.createdAt).toLocaleString(localeTag(locale))}</div>
              {v.feedback && <div className={styles.feedback}>{v.feedback}</div>}
            </div>
            {v.version === finalVersion && <Chip>{text("Final", "Definitief")}</Chip>}
          </div>
        ))}
      </div>
    </details>
  );
}
