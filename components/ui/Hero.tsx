import type { ReactNode } from "react";
import Image from "next/image";
import styles from "./Hero.module.css";

export function Hero({
  title,
  subtitle,
  date,
  logoSlot,
  kicker,
  metaLabel,
}: {
  title: string;
  subtitle?: string;
  date?: string;
  logoSlot?: ReactNode;
  /** Small label above the title, e.g. "PoC Dashboard" — switches Hero into the Power BI
   * report-template layout (logo + divider + kicker/title left, refresh meta right). */
  kicker?: string;
  /** Label for the top-right meta value (usually paired with `date`). Defaults to "Last refresh". */
  metaLabel?: string;
}) {
  const wordmark = logoSlot ?? (
    <Image src="/logo.png" alt="Datavance" width={40} height={40} className={styles.logo} />
  );

  if (kicker) {
    return (
      <div className={styles.hero}>
        <div className={styles.templateRow}>
          <div className={styles.templateLeft}>
            {wordmark}
            <span className={styles.divider} />
            <div>
              <div className={styles.kicker}>{kicker}</div>
              <h1 className={styles.templateTitle}>{title}</h1>
            </div>
          </div>
          {date && (
            <div className={styles.meta}>
              <div className={styles.metaLabel}>{metaLabel ?? "Last refresh"}</div>
              <div className={styles.metaValue}>{date}</div>
            </div>
          )}
        </div>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
    );
  }

  return (
    <div className={styles.hero}>
      {wordmark}
      {date && <div className={styles.date}>{date}</div>}
      <h1 className={styles.title}>{title}</h1>
      {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
    </div>
  );
}
