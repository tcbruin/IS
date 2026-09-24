"use client";

import { useState } from "react";
import { track } from "./track";
import styles from "./RetroCard.module.css";

const ITEMS = [
  { key: "questions", label: "Vragen" },
  { key: "proposal", label: "Voorstel" },
  { key: "dashboard", label: "Dashboard" },
  { key: "email", label: "E-mail" },
] as const;

/**
 * Short look back after a lead (evaluation evidence): how useful was each AI output, and how
 * long would this have taken by hand. Never blocking — every click saves on its own.
 */
export function RetroCard({
  leadId,
  initialRatings,
  initialEstimate,
  defaultEstimate,
}: {
  leadId: string;
  initialRatings: Record<string, number>;
  initialEstimate: number | null;
  defaultEstimate: number;
}) {
  const [ratings, setRatings] = useState(initialRatings);
  const [estimate, setEstimate] = useState(String(initialEstimate ?? defaultEstimate));
  const [savedEstimate, setSavedEstimate] = useState(initialEstimate !== null);
  const [comment, setComment] = useState("");
  const [commentSaved, setCommentSaved] = useState(false);

  function rate(artifact: (typeof ITEMS)[number]["key"], score: number) {
    setRatings((r) => ({ ...r, [artifact]: score }));
    void track(leadId, { type: "rating", artifact, score });
  }

  function saveEstimate() {
    const minutes = Math.round(Number(estimate));
    if (!Number.isFinite(minutes) || minutes < 1) return;
    void track(leadId, { type: "baseline_estimate", minutes });
    setSavedEstimate(true);
  }

  return (
    <div className={styles.card}>
      <h3 className={styles.title}>Terugblik</h3>
      <p className={styles.intro}>Hoe bruikbaar was wat de AI maakte? (1 = onbruikbaar, 5 = direct bruikbaar)</p>
      <div className={styles.grid}>
        {ITEMS.map((item) => (
          <div key={item.key} className={styles.row}>
            <span className={styles.label}>{item.label}</span>
            <span className={styles.stars} role="radiogroup" aria-label={`Score ${item.label}`}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={ratings[item.key] === n}
                  className={[styles.star, (ratings[item.key] ?? 0) >= n ? styles.on : ""].join(" ")}
                  onClick={() => rate(item.key, n)}
                  title={`${n} van 5`}
                >
                  ★
                </button>
              ))}
            </span>
          </div>
        ))}
      </div>

      <label className={styles.estimate}>
        <span>Hoe lang had dit zonder de app gekost?</span>
        <span className={styles.estimateInput}>
          <input
            type="number"
            min={1}
            value={estimate}
            onChange={(e) => {
              setEstimate(e.target.value);
              setSavedEstimate(false);
            }}
            onBlur={saveEstimate}
          />
          minuten {savedEstimate && <span className={styles.saved}>✓ opgeslagen</span>}
        </span>
      </label>

      <label className={styles.comment}>
        <span>Opmerking (optioneel)</span>
        <textarea
          rows={2}
          value={comment}
          onChange={(e) => {
            setComment(e.target.value);
            setCommentSaved(false);
          }}
          placeholder="Wat viel op, wat moet beter?"
        />
      </label>
      {comment.trim() && (
        <button
          type="button"
          className={styles.saveComment}
          onClick={() => {
            void track(leadId, { type: "retro_comment", text: comment.trim() });
            setCommentSaved(true);
          }}
          disabled={commentSaved}
        >
          {commentSaved ? "✓ Opgeslagen" : "Opmerking opslaan"}
        </button>
      )}
    </div>
  );
}
