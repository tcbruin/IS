"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { getStepForRoute } from "@/lib/workflow";

const TICK_SECONDS = 5;
const IDLE_AFTER_MS = 60_000;
const FLUSH_EVERY_MS = 30_000;

/**
 * Measures *active* time per step for the evaluation: a 5-second tick only counts while the
 * tab is visible and there was input in the last minute, so coffee breaks don't inflate the
 * numbers. Totals are flushed with sendBeacon, which survives tab close.
 */
export function ActivityTracker({ leadId }: { leadId: string }) {
  const pathname = usePathname();
  const segments = pathname.split("/");
  const step = segments[4] === "print" ? null : getStepForRoute(segments[3])?.key;

  useEffect(() => {
    if (!step) return;
    let lastInput = Date.now();
    let pending = 0;

    const onInput = () => {
      lastInput = Date.now();
    };
    const tick = window.setInterval(() => {
      if (document.visibilityState === "visible" && Date.now() - lastInput < IDLE_AFTER_MS) {
        pending += TICK_SECONDS;
      }
    }, TICK_SECONDS * 1000);
    const flush = () => {
      if (pending <= 0) return;
      const seconds = pending;
      pending = 0;
      navigator.sendBeacon(
        `/api/leads/${leadId}/events`,
        JSON.stringify({ type: "active_time", step, seconds }),
      );
    };
    const flushTimer = window.setInterval(flush, FLUSH_EVERY_MS);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };

    const inputEvents = ["pointerdown", "pointermove", "keydown", "scroll", "wheel"] as const;
    inputEvents.forEach((e) => window.addEventListener(e, onInput, { passive: true }));
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);

    return () => {
      flush();
      window.clearInterval(tick);
      window.clearInterval(flushTimer);
      inputEvents.forEach((e) => window.removeEventListener(e, onInput));
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
    };
  }, [leadId, step]);

  return null;
}
