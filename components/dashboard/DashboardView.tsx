"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  applyFilterChange,
  buildView,
  defaultFilters,
  formatDateTime,
  generateDataset,
  renderContentHtml,
  renderFilterBarHtml,
} from "@/lib/dashboardEngine";
import type { DashboardRecord } from "@/lib/validation";
import "./canvas.css";

/**
 * The live 1280×720 report page. Data, numbers and the content/filter markup all come from
 * lib/dashboardEngine.js — the same code the offline export inlines — so both always match.
 * Filters work here too, so the consultant previews exactly what the client will click through.
 */
export function DashboardView({ record, companyName }: { record: DashboardRecord; companyName: string }) {
  const ds = useMemo(
    () => generateDataset(record.spec, record.seed, record.generatedAt),
    [record.spec, record.seed, record.generatedAt],
  );
  const [filters, setFilters] = useState(() => defaultFilters(ds));
  const view = useMemo(() => buildView(record.spec, ds, filters), [record.spec, ds, filters]);
  const barRef = useRef<HTMLDivElement>(null);

  // A regenerated dashboard arrives as a new record: start from its default filters.
  useEffect(() => {
    setFilters(defaultFilters(ds));
  }, [ds]);

  // The filter bar markup is engine-rendered, so listen natively (React's synthetic onChange
  // doesn't see elements it didn't create).
  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const onChange = (e: Event) => {
      const target = e.target as HTMLSelectElement;
      setFilters((f) => applyFilterChange(f, { dataset: { ...target.dataset }, value: target.value }));
    };
    const onClick = (e: Event) => {
      if ((e.target as Element).closest("[data-reset]")) setFilters(defaultFilters(ds));
    };
    bar.addEventListener("change", onChange);
    bar.addEventListener("click", onClick);
    return () => {
      bar.removeEventListener("change", onChange);
      bar.removeEventListener("click", onClick);
    };
  }, [ds]);

  return (
    <div className="dv-wrap">
      <div className="dv-canvas">
        <div className="dv-header" />
        <Image src="/logo.png" alt="Datavance" width={40} height={40} className="dv-logo" />
        <div className="dv-divider" />
        <div className="dv-titles">
          <div className="dv-eyebrow">Illustratieve voorbeelddata · {companyName}</div>
          <h1 className="dv-title">{record.spec.title}</h1>
        </div>
        <div className="dv-meta">
          <div className="dv-meta-label">Gegenereerd</div>
          <div className="dv-meta-value">{formatDateTime(record.generatedAt)}</div>
        </div>
        <div ref={barRef} className="dv-filterbar" dangerouslySetInnerHTML={{ __html: renderFilterBarHtml(view, filters) }} />
        <div className="dv-content" dangerouslySetInnerHTML={{ __html: renderContentHtml(view) }} />
        <div className="dv-footer" />
      </div>
    </div>
  );
}
