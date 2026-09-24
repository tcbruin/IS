import type { ReactNode } from "react";
import styles from "./Card.module.css";

const VARIANT_CLASS = {
  light: "",
  dark: "dark",
  creme: "creme",
} as const;

export function Card({
  children,
  variant = "light",
  className,
}: {
  children: ReactNode;
  variant?: keyof typeof VARIANT_CLASS;
  className?: string;
}) {
  const variantClass = styles[VARIANT_CLASS[variant]] ?? "";
  return <div className={[styles.card, variantClass, className].filter(Boolean).join(" ")}>{children}</div>;
}
