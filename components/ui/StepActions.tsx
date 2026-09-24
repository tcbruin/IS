import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./StepActions.module.css";

/** The one place a screen's actions live: a bar stuck to the bottom of the viewport with an
 * optional "← back" on the left and secondary actions + the single primary action on the
 * right. Every step uses it, so the next move is always in the same spot. */
export function StepActions({
  back,
  children,
}: {
  back?: { href: string; label: string };
  children?: ReactNode;
}) {
  return (
    <div className={["no-print", styles.bar].join(" ")}>
      <div className={styles.left}>
        {back && (
          <Link href={back.href} className={styles.back}>
            &larr; {back.label}
          </Link>
        )}
      </div>
      <div className={styles.right}>{children}</div>
    </div>
  );
}
