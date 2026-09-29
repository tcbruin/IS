import { Card } from "@/components/ui/Card";
import { EXTRA_INFO_QUESTION, isAiEstimateAnswer, type Answer, type Question } from "@/lib/validation";
import styles from "./AnswersSummary.module.css";

/** Read-only, compact Q&A list for revisiting answered questions. */
export function AnswersSummary({ questions, answers }: { questions: Question[]; answers: Answer[] }) {
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
              <dt className={styles.question}>{isExtra ? "Additional information" : q.text}</dt>
              <dd className={[styles.answer, isEstimate || !answer ? styles.muted : ""].join(" ")}>
                {isEstimate ? "Let the AI estimate" : answer || "Not answered"}
              </dd>
            </div>
          );
        })}
      </dl>
    </Card>
  );
}
