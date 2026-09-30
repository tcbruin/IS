"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  getSteps,
  getStepForRoute,
  getStepStatus,
  getViewedSubstep,
} from "@/lib/workflow";
import type { Lead } from "@/lib/validation";
import { StepIndicator } from "./StepIndicator";
import { OverflowMenu } from "./OverflowMenu";
import styles from "./LeadHeader.module.css";
import { useLanguage } from "@/components/i18n/LanguageProvider";

/** The one header on every lead page: who, which step (highlighting the page you're on) and
 * that step's substeps. Rare actions live in the ⋯ menu. Hidden on print routes. */
export function LeadHeader({
  lead,
  actions,
  menu,
}: {
  lead: Pick<Lead, "id" | "companyName" | "leadName" | "sourceSystem" | "state" | "demo">;
  /** Quiet inline actions on the right (e.g. "Report an issue"). */
  actions?: ReactNode;
  /** Items inside the ⋯ menu (e.g. "Delete lead"). */
  menu?: ReactNode;
}) {
  const { locale, text } = useLanguage();
  const steps = getSteps(locale);
  const pathname = usePathname();
  const segments = pathname.split("/");
  const segment = segments[3];
  if (segments[4] === "print") return null;

  const baseViewedStep = getStepForRoute(segment);
  const viewedStep = steps.find((step) => step.key === baseViewedStep?.key) ?? null;
  const viewedSub = viewedStep && segment ? getViewedSubstep(viewedStep, segment, lead.state) : null;
  const activeStep = steps.find((s) => getStepStatus(s, lead.state) === "active");
  const lookingBack = viewedStep && activeStep && activeStep.number > viewedStep.number;
  const meta = [lead.leadName, lead.sourceSystem].filter(Boolean).join(" · ");

  return (
    <header className={["no-print", styles.header].join(" ")}>
      <div className={styles.topRow}>
        <Link href="/" className={styles.backLink}>
          &larr; {text("All leads", "Alle leads")}
        </Link>
        <div className={styles.right}>
          {lead.demo && (
            <span className={styles.demoBadge}>
              Demo · {lead.demo.mode === "replay" ? text("recording", "opname") : text("live AI", "live-AI")}
            </span>
          )}
          {actions}
          {menu && <OverflowMenu>{menu}</OverflowMenu>}
        </div>
      </div>

      <h1 className={styles.company}>{lead.companyName}</h1>
      {meta && <p className={styles.meta}>{meta}</p>}

      <div className={styles.steps}>
        <StepIndicator state={lead.state} leadId={lead.id} viewed={viewedStep?.key} />
      </div>

      {viewedStep && viewedSub && (
        <div className={styles.trailRow}>
          <ol className={styles.trail} aria-label={text(`Parts of step ${viewedStep.number}`, `Onderdelen van stap ${viewedStep.number}`)}>
            {viewedStep.substeps.map((sub) => {
              const status = getStepStatus(sub, lead.state);
              const isViewed = sub.key === viewedSub.key;
              return (
                <li
                  key={sub.key}
                  className={[styles.sub, styles[status], isViewed ? styles.subViewed : ""].join(" ")}
                  aria-current={isViewed ? "step" : undefined}
                >
                  {sub.label}
                  {status === "done" && !isViewed && <span className={styles.check}>✓</span>}
                </li>
              );
            })}
          </ol>
          {lookingBack && (
            <Link href={`/leads/${lead.id}`} className={styles.resume}>
              {text("Resume where you left off", "Ga verder waar je gebleven was")} &rarr;
            </Link>
          )}
        </div>
      )}
    </header>
  );
}
