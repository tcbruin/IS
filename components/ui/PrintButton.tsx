"use client";

import { Button } from "./Button";
import { useLanguage } from "@/components/i18n/LanguageProvider";

export function PrintButton() {
  const { text } = useLanguage();
  return (
    <div className="no-print" style={{ marginBottom: 16 }}>
      <Button onClick={() => window.print()}>{text("Print / save as PDF", "Afdrukken / opslaan als PDF")}</Button>
    </div>
  );
}
