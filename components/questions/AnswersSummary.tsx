import { Card } from "@/components/ui/Card";
import { EXTRA_INFO_QUESTION, isAiEstimateAnswer, type Answer, type Question } from "@/lib/validation";
import styles from "./AnswersSummary.module.css";
import { pick, type Locale } from "@/lib/i18n";

/** Read-only, compact Q&A list for revisiting answered questions. */
export function AnswersSummary({ questions, answers, locale = "en" }: { questions: Question[]; answers: Answer[]; locale?: Locale }) {
  return (
    <Card>
      <dl className={styles.list}>
        {questions.map((q) => {
          const answer = answers.find((a) => a.questionId === q.id)?.answer?.trim();
          const isExtra = q.id === EXTRA_INFO_QUESTION.id;
          if (isExtra && !answer) return null;
          const isEstimate = answer !== undefined && isAiEstimateAnswer(answer);
          return (
            <div key={q.id} className={styles.row}>
              <dt className={styles.question}>{isExtra ? pick(locale, "Additional information", "Aanvullende informatie") : q.text}</dt>
              <dd className={[styles.answer, isEstimate || !answer ? styles.muted : ""].join(" ")}>
                {isEstimate ? pick(locale, "Let the AI estimate", "Laat de AI inschatten") : answer || pick(locale, "Not answered", "Niet beantwoord")}
              </dd>
            </div>
          );
        })}
      </dl>
    </Card>
  );
}
