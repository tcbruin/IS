"use client";

import { useLayoutEffect, useRef, type KeyboardEvent } from "react";
import styles from "./ProposalDocument.module.css";

const supportsFieldSizing =
  typeof CSS !== "undefined" && typeof CSS.supports === "function" && CSS.supports("field-sizing", "content");

/** One run of document text: an auto-growing plain-text textarea styled exactly like the
 * surrounding document when editable, a plain div otherwise. Plain text on purpose — native
 * undo, spellcheck and paste-as-text for free, no rich-text editor dependency. */
export function DocText({
  value,
  editable,
  editKey,
  placeholder,
  className,
  onChange,
  onKeyDown,
}: {
  value: string;
  editable: boolean;
  /** Stable address used to move focus here after a split/merge (data-edit-key). */
  editKey: string;
  placeholder?: string;
  className?: string;
  onChange?: (text: string) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // JS fallback for browsers without `field-sizing: content` (e.g. Firefox).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || supportsFieldSizing) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  const cls = [styles.text, className].filter(Boolean).join(" ");
  if (!editable) {
    return <div className={cls}>{value}</div>;
  }
  return (
    <textarea
      ref={ref}
      className={cls}
      value={value}
      rows={1}
      spellCheck
      placeholder={placeholder}
      data-edit-key={editKey}
      onChange={(e) => onChange?.(e.target.value)}
      onKeyDown={onKeyDown}
    />
  );
}
