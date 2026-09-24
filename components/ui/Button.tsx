import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";
import styles from "./Button.module.css";

type Variant = "primary" | "secondary" | "danger";

export function Button({
  variant = "primary",
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={[styles.button, styles[variant], className].filter(Boolean).join(" ")}
      {...rest}
    />
  );
}

/** A link styled as a button — avoids nesting a <button> inside an <a>. */
export function LinkButton({
  href,
  variant = "primary",
  className,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; variant?: Variant }) {
  return (
    <Link
      href={href}
      className={[styles.button, styles.link, styles[variant], className].filter(Boolean).join(" ")}
      {...rest}
    />
  );
}
