import type { ReactNode } from "react";
import styles from "./StepIntro.module.css";

/** Title + at most one line of guidance at the top of a step screen. */
export function StepIntro({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className={styles.intro}>
      <h2 className={styles.title}>{title}</h2>
      {children && <p className={styles.text}>{children}</p>}
    </div>
  );
}
