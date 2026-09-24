/** Hand-rolled Dutch relative-time formatter — no date library in this project (same approach
 * as the hand-rolled number formatting in lib/dashboardEngine.js). */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const diffMin = Math.round((now.getTime() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return "zojuist";
  if (diffMin < 60) return `${diffMin} min geleden`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH} uur geleden`;
  const diffD = Math.round(diffH / 24);
  if (diffD < 7) return `${diffD} dag${diffD === 1 ? "" : "en"} geleden`;
  return new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" });
}
