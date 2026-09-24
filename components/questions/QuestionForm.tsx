"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextArea } from "@/components/ui/Form";
import { StepActions } from "@/components/ui/StepActions";
import { AI_ESTIMATE_SENTINEL, EXTRA_INFO_QUESTION, type Answer, type Question } from "@/lib/validation";
import styles from "./QuestionForm.module.css";

export function QuestionForm({
  questions,
  submitUrl,
  initialAnswers,
  submitLabel = "Antwoorden opslaan",
  redirectTo,
  back,
  extraActions,
}: {
  questions: Question[];
  submitUrl: string;
  initialAnswers?: Answer[];
  submitLabel?: string;
  /** On success, navigate here instead of staying put — the next step's own autoTrigger then
   * starts immediately. */
  redirectTo?: string;
  back?: { href: string; label: string };
  /** Secondary actions rendered in the action bar next to the submit button. */
  extraActions?: ReactNode;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (initialAnswers ?? [])
        .filter((a) => a.answer !== AI_ESTIMATE_SENTINEL)
        .map((a) => [a.questionId, a.answer]),
    ),
  );
  // Pre-check "laat de AI inschatten" on edit if that's exactly what was submitted before.
  const [estimateFlags, setEstimateFlags] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      (initialAnswers ?? [])
        .filter((a) => a.answer === AI_ESTIMATE_SENTINEL)
        .map((a) => [a.questionId, true]),
    ),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const answers = questions.map((q) => ({
        questionId: q.id,
        answer: estimateFlags[q.id] ? AI_ESTIMATE_SENTINEL : (values[q.id]?.trim() ?? ""),
      }));
      const res = await fetch(submitUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Opslaan van antwoorden mislukt.");
      }
      if (redirectTo) router.push(redirectTo);
      // Also after a push: the lead layout's step bar stays mounted across client navigation.
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Er ging iets mis.");
    } finally {
      // Resubmits without redirect keep this form mounted — reset so it never sticks on "Bezig".
      setSubmitting(false);
    }
  }

  let number = 0;
  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <ol className={styles.list}>
          {questions.map((q) => {
            const isExtraInfo = q.id === EXTRA_INFO_QUESTION.id;
            const estimating = estimateFlags[q.id] ?? false;
            if (!isExtraInfo) number++;
            const fieldId = `q-${q.id}`;
            return (
              <li key={q.id} className={[styles.item, isExtraInfo ? styles.extra : ""].join(" ")}>
                <label htmlFor={fieldId} className={styles.question}>
                  {!isExtraInfo && <span className={styles.number}>{number}</span>}
                  <span>{q.text}</span>
                </label>
                {q.hint && <p className={styles.hint}>{q.hint}</p>}
                <TextArea
                  id={fieldId}
                  value={values[q.id] ?? ""}
                  onChange={(e) => setValues({ ...values, [q.id]: e.target.value })}
                  placeholder={estimating ? "De AI maakt hier een onderbouwde inschatting." : isExtraInfo ? "Optioneel" : "Kort is prima"}
                  disabled={estimating}
                  rows={2}
                />
                {!isExtraInfo && (
                  <label className={styles.estimateRow}>
                    <input
                      type="checkbox"
                      checked={estimating}
                      onChange={(e) => setEstimateFlags({ ...estimateFlags, [q.id]: e.target.checked })}
                    />
                    Weet ik niet — laat de AI inschatten
                  </label>
                )}
              </li>
            );
          })}
        </ol>
      </Card>
      {error && <p className={styles.error}>{error}</p>}
      <StepActions back={back}>
        {extraActions}
        <Button type="submit" disabled={submitting}>
          {submitting ? "Bezig..." : submitLabel}
        </Button>
      </StepActions>
    </form>
  );
}
