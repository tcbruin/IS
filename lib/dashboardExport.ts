import { promises as fs } from "fs";
import path from "path";
import type { DashboardRecord } from "./validation";
import { escapeHtml } from "./dashboardEngine";

/**
 * Standalone, offline, interactive HTML version of a dashboard. It inlines the SAME engine
 * (lib/dashboardEngine.js) and stylesheet (components/dashboard/canvas.css) the live page uses,
 * plus the spec — the browser regenerates the illustrative data and re-renders on every filter
 * change, so the file needs no server and no CDN, and shows exactly the live page's numbers.
 */
export async function renderDashboardExport(input: {
  record: DashboardRecord;
  companyName: string;
  logoBase64: string;
}): Promise<string> {
  const [engineSource, css] = await Promise.all([
    fs.readFile(path.join(process.cwd(), "lib", "dashboardEngine.js"), "utf-8"),
    fs.readFile(path.join(process.cwd(), "components", "dashboard", "canvas.css"), "utf-8"),
  ]);
  if (/^\s*import\s/m.test(engineSource)) {
    throw new Error("lib/dashboardEngine.js mag niets importeren: het wordt letterlijk in de export geplakt.");
  }
  const engine = engineSource.replace(/^export /gm, "");
  const data = JSON.stringify({
    spec: input.record.spec,
    seed: input.record.seed,
    generatedAt: input.record.generatedAt,
  })
    .replace(/<\/script/gi, "<\\/script")
    .replace(/<!--/g, "<\\!--");
  const company = escapeHtml(input.companyName);
  const title = escapeHtml(input.record.spec.title);

  return `<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · ${company}</title>
<style>
:root { --font-body: Manrope, "Segoe UI", Arial, sans-serif; --font-heading: Epilogue, "Segoe UI", Arial, sans-serif; }
body { margin: 0; padding: 24px; background: #e8e6e3; font-family: var(--font-body); color: #264549; }
.dv-wrap { width: max-content; margin: 0 auto; box-shadow: 0 2px 10px rgba(0,0,0,.12); }
.dv-note { width: 1280px; margin: 12px auto 0; font-size: 13px; opacity: .7; }
${css}
</style>
</head>
<body>
<div class="dv-wrap"><div class="dv-canvas">
  <div class="dv-header"></div>
  <img class="dv-logo" alt="Datavance" src="data:image/png;base64,${input.logoBase64}">
  <div class="dv-divider"></div>
  <div class="dv-titles"><div class="dv-eyebrow">Illustratieve voorbeelddata · ${company}</div><h1 class="dv-title">${title}</h1></div>
  <div class="dv-meta"><div class="dv-meta-label">Gegenereerd</div><div class="dv-meta-value" id="dv-generated"></div></div>
  <div class="dv-filterbar" id="dv-filterbar"></div>
  <div class="dv-content" id="dv-content"></div>
  <div class="dv-footer"></div>
</div></div>
<p class="dv-note">Alle cijfers in dit dashboard zijn illustratieve voorbeelddata, geen echte gegevens van ${company}. Het laat zien hoe het inzicht eruit komt te zien.</p>
<script>
(function () {
"use strict";
${engine}
var DATA = ${data};
var ds = generateDataset(DATA.spec, DATA.seed, DATA.generatedAt);
var filters = defaultFilters(ds);
var bar = document.getElementById("dv-filterbar");
var content = document.getElementById("dv-content");
document.getElementById("dv-generated").textContent = formatDateTime(DATA.generatedAt);
function render() {
  var view = buildView(DATA.spec, ds, filters);
  bar.innerHTML = renderFilterBarHtml(view, filters);
  content.innerHTML = renderContentHtml(view);
}
bar.addEventListener("change", function (e) { filters = applyFilterChange(filters, e.target); render(); });
bar.addEventListener("click", function (e) { if (e.target.closest("[data-reset]")) { filters = defaultFilters(ds); render(); } });
render();
})();
</script>
</body>
</html>`;
}
