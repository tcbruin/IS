"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LOCALE_COOKIE, pick, type Locale } from "@/lib/i18n";
import styles from "./LanguageSwitcher.module.css";

type LanguageContextValue = {
  locale: Locale;
  text: <T>(english: T, dutch: T) => T;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ initialLocale, children }: { initialLocale: Locale; children: ReactNode }) {
  const router = useRouter();
  const [locale, setLocale] = useState(initialLocale);
  const value = useMemo(
    () => ({ locale, text: <T,>(english: T, dutch: T) => pick(locale, english, dutch) }),
    [locale],
  );

  function change(next: Locale) {
    if (next === locale) return;
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    setLocale(next);
    router.refresh();
  }

  return (
    <LanguageContext.Provider value={value}>
      <div className={["no-print", styles.switcher].join(" ")} role="group" aria-label={pick(locale, "Language", "Taal")}>
        <button type="button" className={locale === "en" ? styles.active : ""} onClick={() => change("en")} aria-pressed={locale === "en"}>
          EN
        </button>
        <span aria-hidden="true">/</span>
        <button type="button" className={locale === "nl" ? styles.active : ""} onClick={() => change("nl")} aria-pressed={locale === "nl"}>
          NL
        </button>
      </div>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const value = useContext(LanguageContext);
  if (!value) throw new Error("useLanguage must be used inside LanguageProvider");
  return value;
}

