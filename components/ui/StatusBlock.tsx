import styles from "./StatusBlock.module.css";

const TONE_ICON: Record<string, string> = {
  attention: "⚠",
  done: "✓",
  neutral: "•",
};

export function StatusBlock({
  tone,
  children,
}: {
  tone: "attention" | "done" | "neutral";
  children: React.ReactNode;
}) {
  return (
    <div className={[styles.block, styles[tone]].join(" ")}>
      <span aria-hidden="true">{TONE_ICON[tone]}</span>
      <span>{children}</span>
    </div>
  );
}
