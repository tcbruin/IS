"use client";

import { useCallback, useEffect, useLayoutEffect, useState, type RefObject } from "react";
import { PAGE, PX_PER_MM } from "@/lib/proposalLayout";

const PAGE_H = PAGE.heightMm * PX_PER_MM;
const CONTENT_TOP = PAGE.marginMm * PX_PER_MM;
const CONTENT_BOTTOM = (PAGE.heightMm - PAGE.marginMm) * PX_PER_MM;
const CONTENT_H = CONTENT_BOTTOM - CONTENT_TOP;

/**
 * Word-style pagination without moving DOM nodes. All blocks ([data-pblock]) stay in one
 * normal flow; each gets a computed padding-top that pushes it onto the next page when it
 * doesn't fit. The white sheets are drawn separately behind the flow. Because blocks never
 * change parent, React never remounts them and focus/caret survive re-pagination.
 *
 * Screen and print need different spacers, both written as CSS variables:
 * - screen (--sp-screen): the full distance, including the grey gap between sheets;
 * - print (--sp-print): browsers can't break a page inside padding and drop margins at page
 *   breaks, so a block that starts a new page gets a real `break-before: page`
 *   ([data-newpage]) plus only its offset from the top of that page (the top margin).
 * Block wrappers carry no styling of their own, so the spacer padding is the only padding.
 *
 * Positions are computed in "paper" coordinates (pages stacked without gaps). A block that
 * doesn't fit moves as a whole ("regels bijeenhouden"); data-keep="1" also keeps it with the
 * next block (headings).
 */
function paginate(flow: HTMLElement): number {
  const blocks = Array.from(flow.querySelectorAll<HTMLElement>("[data-pblock]"));
  // Natural height = rendered height minus the spacer we applied last time.
  const heights = blocks.map(
    (b) => b.getBoundingClientRect().height - (parseFloat(getComputedStyle(b).paddingTop) || 0),
  );

  let page = 0;
  let prevStartPage = 0;
  let prevBottom = 0;
  let y = CONTENT_TOP;

  blocks.forEach((el, i) => {
    const h = heights[i];
    let need = h;
    if (el.dataset.keep === "1" && i + 1 < blocks.length && h + heights[i + 1] <= CONTENT_H) {
      need = h + heights[i + 1];
    }
    let top = Math.max(y, page * PAGE_H + CONTENT_TOP);
    if (top + need > page * PAGE_H + CONTENT_BOTTOM + 0.5 && top > page * PAGE_H + CONTENT_TOP + 0.5) {
      page += 1;
      top = page * PAGE_H + CONTENT_TOP;
    }

    const spacer = top - prevBottom;
    const gaps = page - prevStartPage;
    const signature = `${spacer.toFixed(1)}|${gaps}`;
    if (el.dataset.spacer !== signature) {
      el.dataset.spacer = signature;
      el.style.setProperty("--sp-screen", `calc(${spacer.toFixed(2)}px + ${gaps} * var(--page-gap))`);
      el.style.setProperty("--sp-print", `${(gaps > 0 ? top - page * PAGE_H : spacer).toFixed(2)}px`);
      if (gaps > 0) el.dataset.newpage = "1";
      else delete el.dataset.newpage;
    }

    prevStartPage = page;
    const bottom = top + h;
    // A block taller than a page runs across the page break; continue on the page it ends on.
    if (bottom > page * PAGE_H + CONTENT_BOTTOM) page = Math.floor(bottom / PAGE_H);
    prevBottom = bottom;
    y = bottom;
  });

  return page + 1;
}

export function usePagination(flowRef: RefObject<HTMLElement | null>): number {
  const [pageCount, setPageCount] = useState(1);

  const run = useCallback(() => {
    if (flowRef.current) setPageCount(paginate(flowRef.current));
  }, [flowRef]);

  // After every render: text changes alter block heights.
  useLayoutEffect(() => {
    run();
  });

  // Height changes that don't come from a React render (web fonts arriving, window resize).
  useEffect(() => {
    const flow = flowRef.current;
    if (!flow) return;
    let frame = 0;
    // rAF avoids "ResizeObserver loop" warnings: our own margin updates resize the flow too.
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(run);
    });
    observer.observe(flow);
    document.fonts?.ready.then(run);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [flowRef, run]);

  return pageCount;
}
