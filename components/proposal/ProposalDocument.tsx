"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import {
  paraKey,
  phaseKey,
  type EditorAction,
  type EditorDoc,
  type ListField,
  type ParaField,
  type TextField,
} from "@/lib/proposalDocument";
import { getProposalSections, type ProposalSectionKey } from "@/lib/proposalSections";
import { PAGE, TYPE } from "@/lib/proposalLayout";
import { DocText } from "./DocText";
import { usePagination } from "./usePagination";
import styles from "./ProposalDocument.module.css";
import { useLanguage } from "@/components/i18n/LanguageProvider";

const PLACEHOLDERS: Record<ParaField, string> = {
  coverIntro: "Type the introduction here…",
  situation: "Describe the current situation…",
  approach: "Describe the approach…",
  investment: "Describe the investment…",
  nextSteps: "Describe the next steps…",
  goals: "Goal…",
  scopeDeliverables: "Deliverable…",
};

const DUTCH_PLACEHOLDERS: Record<ParaField, string> = {
  coverIntro: "Typ hier de introductie…",
  situation: "Beschrijf de huidige situatie…",
  approach: "Beschrijf de aanpak…",
  investment: "Beschrijf de investering…",
  nextSteps: "Beschrijf de volgende stappen…",
  goals: "Doel…",
  scopeDeliverables: "Op te leveren onderdeel…",
};

/** Layout numbers from lib/proposalLayout.ts, exposed to the CSS as custom properties. */
const PAGE_VARS = {
  "--page-w": `${PAGE.widthMm}mm`,
  "--page-h": `${PAGE.heightMm}mm`,
  "--page-margin": `${PAGE.marginMm}mm`,
  "--header-top": `${PAGE.headerMm}mm`,
  "--footer-bottom": `${PAGE.footerMm}mm`,
  "--body-pt": `calc(${TYPE.bodyPt}pt * var(--fit-scale, 1))`,
  "--body-lh": `${TYPE.lineHeight}`,
  "--intro-pt": `calc(${TYPE.introPt}pt * var(--fit-scale, 1))`,
  "--title-pt": `calc(${TYPE.titlePt}pt * var(--fit-scale, 1))`,
  "--date-pt": `calc(${TYPE.datePt}pt * var(--fit-scale, 1))`,
  "--heading-pt": `calc(${TYPE.headingPt}pt * var(--fit-scale, 1))`,
  "--phase-pt": `calc(${TYPE.phasePt}pt * var(--fit-scale, 1))`,
  "--running-pt": `${TYPE.runningPt}pt`,
} as CSSProperties;

export type Comments = Partial<Record<ProposalSectionKey, string>>;

/** One pagination unit. The unstyled outer div receives the pagination spacer (padding-top);
 * all visual styling sits on the inner div so the two never interfere. */
function Block({ keep, className, children }: { keep?: boolean; className?: string; children: ReactNode }) {
  return (
    <div data-pblock="" data-keep={keep ? "1" : undefined}>
      <div className={className}>{children}</div>
    </div>
  );
}

/**
 * The proposal as real A4 pages (Word "print layout"): white sheets on the grey desk, running
 * header/footer with page numbers, and — when editable — click-to-type text. Structural keys
 * follow Word: Enter = new paragraph/item, Shift+Enter = line break, Backspace at the start
 * merges with the paragraph above (or removes an empty list item).
 */
export function ProposalDocument({
  companyName,
  dateLabel,
  doc,
  editable,
  onAction,
  onFocusRequest,
  comments,
  onCommentChange,
  invalidSections,
  onStats,
  fitToPage = false,
}: {
  companyName: string;
  dateLabel: string;
  doc: EditorDoc;
  editable: boolean;
  onAction?: (action: EditorAction) => void;
  onFocusRequest?: (key: string, caret: number) => void;
  /** Word-style comment balloons in the right margin (never printed). Omit to hide them. */
  comments?: Comments;
  onCommentChange?: (key: ProposalSectionKey, value: string) => void;
  invalidSections?: Set<string>;
  onStats?: (stats: { pageCount: number }) => void;
  fitToPage?: boolean;
}) {
  const { locale, text } = useLanguage();
  const placeholders = locale === "nl" ? DUTCH_PLACEHOLDERS : PLACEHOLDERS;
  const sections = getProposalSections(locale);
  const flowRef = useRef<HTMLDivElement>(null);
  const pageCount = usePagination(flowRef, fitToPage);

  useEffect(() => {
    onStats?.({ pageCount });
  }, [pageCount, onStats]);

  function paraKeyDown(field: ParaField, id: string, index: number, isList: boolean) {
    return (e: KeyboardEvent<HTMLTextAreaElement>) => {
      const t = e.currentTarget;
      if (e.nativeEvent.isComposing) return;
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        onAction?.({
          type: "split",
          field,
          id,
          before: t.value.slice(0, t.selectionStart),
          after: t.value.slice(t.selectionEnd),
        });
      } else if (e.key === "Backspace" && t.selectionStart === 0 && t.selectionEnd === 0) {
        if (isList && t.value === "" && doc[field].length > 1) {
          e.preventDefault();
          onAction?.({ type: "remove", field, id });
        } else if (index > 0) {
          e.preventDefault();
          onAction?.({ type: "merge", field, id });
        }
      }
    };
  }

  /** `asBlocks` false inside the callout, which paginates as one unit. */
  function textField(field: TextField, blockClass: string, asBlocks = true) {
    return doc[field].map((p, i) => {
      const text = (
        <DocText
          value={p.text}
          editable={editable}
          editKey={paraKey(field, p.id)}
          placeholder={placeholders[field]}
          onChange={(value) => onAction?.({ type: "setText", field, id: p.id, text: value })}
          onKeyDown={paraKeyDown(field, p.id, i, false)}
        />
      );
      return asBlocks ? (
        <Block key={p.id} className={blockClass}>
          {text}
        </Block>
      ) : (
        <div key={p.id} className={blockClass}>
          {text}
        </div>
      );
    });
  }

  function listField(field: ListField) {
    return doc[field].map((p, i) => (
      <Block key={p.id} className={styles.item}>
        <DocText
          value={p.text}
          editable={editable}
          editKey={paraKey(field, p.id)}
          placeholder={placeholders[field]}
          onChange={(text) => onAction?.({ type: "setText", field, id: p.id, text })}
          onKeyDown={paraKeyDown(field, p.id, i, true)}
        />
      </Block>
    ));
  }

  function phases() {
    return doc.phases.map((phase, i) => (
      <Block key={phase.id} className={[styles.phase, i > 0 ? styles.phaseDivider : ""].join(" ")}>
        <DocText
          value={phase.name}
          editable={editable}
          editKey={phaseKey(phase.id, "name")}
          placeholder={text("Phase name…", "Naam van fase…")}
          className={styles.phaseName}
          onChange={(text) => onAction?.({ type: "setPhase", id: phase.id, key: "name", text })}
          onKeyDown={(e) => {
            const t = e.currentTarget;
            if (e.key === "Enter") {
              e.preventDefault();
              onFocusRequest?.(phaseKey(phase.id, "description"), 0);
            } else if (e.key === "Backspace" && t.value === "" && !phase.description && doc.phases.length > 1) {
              e.preventDefault();
              onAction?.({ type: "removePhase", id: phase.id });
            }
          }}
        />
        <DocText
          value={phase.description}
          editable={editable}
          editKey={phaseKey(phase.id, "description")}
          placeholder={text("What happens in this phase…", "Wat gebeurt er in deze fase…")}
          onChange={(text) => onAction?.({ type: "setPhase", id: phase.id, key: "description", text })}
          onKeyDown={(e) => {
            const t = e.currentTarget;
            if (e.key === "Backspace" && t.selectionStart === 0 && t.selectionEnd === 0) {
              e.preventDefault();
              onFocusRequest?.(phaseKey(phase.id, "name"), phase.name.length);
            }
          }}
        />
        {editable && i === doc.phases.length - 1 && (
          <button
            type="button"
            className={styles.addPhase}
            onClick={() => onAction?.({ type: "addPhase", afterId: phase.id })}
          >
            {text("+ Add phase", "+ Fase toevoegen")}
          </button>
        )}
      </Block>
    ));
  }

  return (
    <div
      className={styles.canvas}
      style={
        {
          ...PAGE_VARS,
          "--canvas-h": `calc(${pageCount} * var(--page-h) + ${pageCount - 1} * var(--page-gap))`,
        } as CSSProperties
      }
      lang={locale}
    >
      {Array.from({ length: pageCount }, (_, k) => (
        <div
          key={k}
          className={styles.sheet}
          style={{ top: `calc(${k} * (var(--page-h) + var(--page-gap)))` }}
          aria-hidden="true"
        >
          <div className={styles.runningHeader}>
            <span className={styles.brand}>
              <Image src="/logo.png" alt="" width={26} height={26} />
              Datavance
            </span>
            <span>{companyName}</span>
          </div>
          <div className={styles.runningFooter}>
            <span>Datavance — {text("Confidential", "Vertrouwelijk")} — {companyName}</span>
            <span>
              {text("Page", "Pagina")} {k + 1} {text("of", "van")} {pageCount}
            </span>
          </div>
        </div>
      ))}

      <div ref={flowRef} style={PAGE_VARS} className={[styles.flow, editable ? styles.editable : ""].join(" ")}>
        <Block keep className={styles.titleBlock}>
          <h1 className={styles.title}>{text("Proposal for", "Voorstel voor")} {companyName}</h1>
          <div className={styles.date}>{dateLabel}</div>
        </Block>
        {textField("coverIntro", styles.intro)}

        {sections.map((section) => (
          <div key={section.key} className={styles.section}>
            <Block
              keep
              className={[section.heading ? styles.heading : styles.commentAnchor, invalidSections?.has(section.key) ? styles.invalid : ""].join(" ")}
            >
              {section.heading && <h2 className={styles.headingText}>{section.heading}</h2>}
              {comments && onCommentChange && (
                <CommentBalloon
                  label={section.label}
                  value={comments[section.key] ?? ""}
                  onChange={(v) => onCommentChange(section.key, v)}
                />
              )}
            </Block>
            {section.kind === "text" && textField(section.key, styles.para)}
            {section.kind === "list" && listField(section.key)}
            {section.kind === "phases" && phases()}
            {section.kind === "callout" && (
              <Block className={styles.calloutWrap}>
                <div className={styles.callout}>{textField("investment", styles.calloutPara, false)}</div>
              </Block>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** "+ Comment" in the right margin next to a heading; opens a Word-style comment balloon. */
function CommentBalloon({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { text } = useLanguage();
  const [open, setOpen] = useState(false);
  const hasText = value.trim().length > 0;

  if (!open && !hasText) {
    return (
      <div className={styles.gutter}>
        <button type="button" className={styles.commentTrigger} onClick={() => setOpen(true)}>
          {text("+ Comment for the AI", "+ Opmerking voor de AI")}
        </button>
      </div>
    );
  }

  return (
    <div className={[styles.gutter, styles.gutterOpen].join(" ")}>
      <div className={styles.balloon}>
        <div className={styles.balloonLabel}>{text("Comment", "Opmerking")} · {label}</div>
        <textarea
          className={styles.balloonInput}
          value={value}
          autoFocus={!hasText}
          placeholder={text("What should the AI do differently here?", "Wat moet de AI hier anders doen?")}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
        />
        <button
          type="button"
          className={styles.balloonRemove}
          onClick={() => {
            onChange("");
            setOpen(false);
          }}
        >
          {text("Remove", "Verwijderen")}
        </button>
      </div>
    </div>
  );
}
