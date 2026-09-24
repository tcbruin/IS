"use client";

import { useEffect, useRef, type ReactNode } from "react";
import styles from "./OverflowMenu.module.css";

/** A quiet "⋯" menu for rare or destructive actions, so they don't compete with the page's
 * primary action. Native <details>; closes on outside click. */
export function OverflowMenu({ children, label = "Meer acties" }: { children: ReactNode; label?: string }) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current?.open && !ref.current.contains(e.target as Node)) ref.current.open = false;
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return (
    <details ref={ref} className={styles.menu}>
      <summary className={styles.trigger} aria-label={label} title={label}>
        ⋯
      </summary>
      <div className={styles.panel}>{children}</div>
    </details>
  );
}
