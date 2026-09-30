"use client";

import { useState } from "react";
import { track } from "./track";
import styles from "./RetroCard.module.css";
import { useLanguage } from "@/components/i18n/LanguageProvider";

const ITEMS = [
  { key: "questions", label: "Questions" },
  { key: "proposal", label: "Proposal" },
  { key: "dashboard", label: "Dashboard" },
  { key: "email", label: "Email" },
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
  const { locale, text } = useLanguage();
  const items = locale === "nl" ? [
    { key: "questions", label: "Vragen" },
    { key: "proposal", label: "Voorstel" },
    { key: "dashboard", label: "Dashboard" },
    { key: "email", label: "E-mail" },
  ] as const : ITEMS;
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
      <h3 className={styles.title}>{text("Retrospective", "Terugblik")}</h3>
      <p className={styles.intro}>{text("How useful was what the AI produced? (1 = unusable, 5 = usable as is)", "Hoe bruikbaar was wat de AI opleverde? (1 = onbruikbaar, 5 = direct bruikbaar)")}</p>
      <div className={styles.grid}>
        {items.map((item) => (
          <div key={item.key} className={styles.row}>
            <span className={styles.label}>{item.label}</span>
            <span className={styles.stars} role="radiogroup" aria-label={`${text("Score", "Beoordeling")} ${item.label}`}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={ratings[item.key] === n}
                  className={[styles.star, (ratings[item.key] ?? 0) >= n ? styles.on : ""].join(" ")}
                  onClick={() => rate(item.key, n)}
                  title={text(`${n} of 5`, `${n} van 5`)}
                >
                  ★
                </button>
              ))}
            </span>
          </div>
        ))}
      </div>

      <label className={styles.estimate}>
        <span>{text("How long would this have taken without the app?", "Hoe lang had dit zonder de app geduurd?")}</span>
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
          {text("minutes", "minuten")} {savedEstimate && <span className={styles.saved}>✓ {text("saved", "opgeslagen")}</span>}
        </span>
      </label>

      <label className={styles.comment}>
        <span>{text("Comment (optional)", "Opmerking (optioneel)")}</span>
        <textarea
          rows={2}
          value={comment}
          onChange={(e) => {
            setComment(e.target.value);
            setCommentSaved(false);
          }}
          placeholder={text("What stood out, what should improve?", "Wat viel op en wat kan beter?")}
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
          {commentSaved ? `✓ ${text("Saved", "Opgeslagen")}` : text("Save comment", "Opmerking opslaan")}
        </button>
      )}
    </div>
  );
}
