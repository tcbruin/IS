import { Card } from "./Card";
import { GenerateButton } from "./GenerateButton";
import styles from "./AutoGenerateCard.module.css";

/** Shown on screens where the AI starts on its own as soon as you arrive (the step before
 * already collected everything it needs). The button doubles as progress indicator and as the
 * retry if the call fails. */
export function AutoGenerateCard({
  title,
  description,
  url,
  label,
  busyLabel,
}: {
  title: string;
  description: string;
  url: string;
  label: string;
  busyLabel: string;
}) {
  return (
    <Card className={styles.card}>
      <div className={styles.pulse} aria-hidden="true" />
      <div>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.description}>{description}</p>
        <GenerateButton url={url} label={label} busyLabel={busyLabel} autoTrigger />
      </div>
    </Card>
  );
}
