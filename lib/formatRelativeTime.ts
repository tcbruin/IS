/** Hand-rolled English relative-time formatter — no date library in this project (same approach
 * as the hand-rolled number formatting in lib/dashboardEngine.js). */
import { localeTag, pick, type Locale } from "./i18n";

export function formatRelativeTime(iso: string, now: Date = new Date(), locale: Locale = "en"): string {
  const diffMin = Math.round((now.getTime() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return pick(locale, "just now", "zojuist");
  if (diffMin < 60) return pick(locale, `${diffMin} min ago`, `${diffMin} min geleden`);
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return pick(locale, `${diffH} hr ago`, `${diffH} uur geleden`);
  const diffD = Math.round(diffH / 24);
  if (diffD < 7) return pick(locale, `${diffD} day${diffD === 1 ? "" : "s"} ago`, `${diffD} dag${diffD === 1 ? "" : "en"} geleden`);
  return new Date(iso).toLocaleDateString(localeTag(locale), { day: "numeric", month: "short", year: "numeric" });
}
