export const LOCALES = ["en", "nl"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "datavance-locale";

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "nl";
}

export function localeTag(locale: Locale): string {
  return locale === "nl" ? "nl-NL" : "en-GB";
}

export function pick<T>(locale: Locale, english: T, dutch: T): T {
  return locale === "nl" ? dutch : english;
}

