"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  applyEditorAction,
  countWords,
  normalizeProposalContent,
  toEditorDoc,
  toProposalContent,
  type EditorAction,
  type FocusTarget,
} from "@/lib/proposalDocument";
import { PROPOSAL_SECTIONS, composeSectionFeedback, getProposalSections } from "@/lib/proposalSections";
import { proposalContentSchema, type ProposalContent, type ProposalVersion } from "@/lib/validation";
import { Button, LinkButton } from "@/components/ui/Button";
import { StatusBlock } from "@/components/ui/StatusBlock";
import { StepActions } from "@/components/ui/StepActions";
import { ProposalDocument, type Comments } from "./ProposalDocument";
import { useUnsavedChangesGuard } from "./useUnsavedChangesGuard";
import styles from "./ProposalWorkspace.module.css";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import type { Locale } from "@/lib/i18n";

type Mode = "edit" | "old" | "final";
type Status = "idle" | "saving" | "ai" | "finalizing" | "reopening";

function describeIssues(content: ProposalContent, locale: Locale): { sections: Set<string>; messages: string[] } {
  const labels: Record<string, string> = {
    coverIntro: locale === "nl" ? "Introductie" : "Introduction",
    ...Object.fromEntries(getProposalSections(locale).map((s) => [s.key, s.label])),
  };
  const result = proposalContentSchema.safeParse(content);
  const sections = new Set<string>();
  const messages: string[] = [];
  if (result.success) return { sections, messages };
  for (const issue of result.error.issues) {
    const field = String(issue.path[0]);
    sections.add(field);
    if (field === "timeline" && typeof issue.path[2] === "number") {
      const part = issue.path[3] === "name" ? (locale === "nl" ? "naam" : "name") : (locale === "nl" ? "beschrijving" : "description");
      messages.push(locale === "nl" ? `Planning: fase ${issue.path[2] + 1} heeft nog geen ${part}.` : `Timeline: phase ${issue.path[2] + 1} has no ${part} yet.`);
    } else {
      messages.push(locale === "nl" ? `${labels[field] ?? field} is nog leeg.` : `${labels[field] ?? field} is still empty.`);
    }
  }
  return { sections, messages: [...new Set(messages)] };
}

const json = (c: ProposalContent) => JSON.stringify(normalizeProposalContent(c));

/**
 * The proposal step: the document dominates, with one slim toolbar for document actions (save,
 * ask the AI, Word, print) and the step's primary action in the bottom bar. Two ways to change
 * a section: type in it, or leave a comment in the margin and let the AI rework it. Every save
 * and every AI round is a new, immutable version.
 */
export function ProposalWorkspace({
  leadId,
  companyName,
  mode,
  version,
  isSent,
  dateLabel,
  contextPanel,
  historyPanel,
  demoFeedback,
}: {
  leadId: string;
  companyName: string;
  mode: Mode;
  version: ProposalVersion;
  isSent: boolean;
  dateLabel: string;
  contextPanel: ReactNode;
  historyPanel: ReactNode;
  /** Demo leads only: the margin comments recorded in the demo run. */
  demoFeedback?: Record<string, string> | null;
}) {
  const { locale, text } = useLanguage();
  const router = useRouter();
  const [doc, setDoc] = useState(() => toEditorDoc(version.content));
  const [baseline, setBaseline] = useState(() => json(version.content));
  const [shownVersion, setShownVersion] = useState(version.version);
  const [justSaved, setJustSaved] = useState<number | null>(null);
  const [comments, setComments] = useState<Comments>({});
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<number | null>(null);
  const [issues, setIssues] = useState<{ sections: Set<string>; messages: string[] } | null>(null);
  const [pageCount, setPageCount] = useState(1);
  const [elapsed, setElapsed] = useState(0);
  const pendingFocus = useRef<FocusTarget | null>(null);

  // A different version arrived from the server (AI round, reopen, another tab): show it —
  // unless it's the version we just saved ourselves, which already is what's on screen.
  if (version.version !== shownVersion) {
    setShownVersion(version.version);
    setBaseline(json(version.content));
    if (version.version !== justSaved) setDoc(toEditorDoc(version.content));
  }

  const content = useMemo(() => toProposalContent(doc), [doc]);
  const editable = mode === "edit" && status !== "ai" && status !== "finalizing";
  const dirty = mode === "edit" && JSON.stringify(content) !== baseline;
  const commentCount = Object.values(comments).filter((c) => c?.trim()).length;
  const busy = status !== "idle";

  useUnsavedChangesGuard(dirty || commentCount > 0);

  const dispatch = useCallback(
    (action: EditorAction) => {
      const result = applyEditorAction(doc, action);
      if (result.focus) pendingFocus.current = result.focus;
      setDoc(result.doc);
      if (issues) setIssues(null);
    },
    [doc, issues],
  );

  const focusField = useCallback((key: string, caret: number) => {
    const el = document.querySelector<HTMLTextAreaElement>(`[data-edit-key="${CSS.escape(key)}"]`);
    el?.focus();
    el?.setSelectionRange(caret, caret);
  }, []);

  useLayoutEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    focusField(target.key, target.caret);
  }, [doc, focusField]);

  useEffect(() => {
    if (status !== "ai") return;
    setElapsed(0);
    const started = Date.now();
    const id = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(id);
  }, [status]);

  /** Saves unsaved edits as a manual version. Resolves to the version everything else should
   * act on, or null when saving wasn't possible (empty sections, conflict, error). */
  const save = useCallback(
    async (force = false): Promise<number | null> => {
      if (!dirty) return shownVersion;
      const found = describeIssues(content, locale);
      if (found.messages.length) {
        setIssues(found);
        return null;
      }
      setStatus("saving");
      setError(null);
      try {
        const res = await fetch(`/api/leads/${leadId}/proposal/edit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content, basedOnVersion: shownVersion, force }),
        });
        const body = await res.json().catch(() => ({}));
        if (res.status === 409 && body.code === "stale_version") {
          setConflict(body.latestVersion);
          return null;
        }
        if (!res.ok) throw new Error(body.error ?? text("Could not save.", "Opslaan is mislukt."));
        const saved = body as ProposalVersion;
        setConflict(null);
        setBaseline(json(saved.content));
        // Guardrails may have fixed something (e.g. brand spelling) — show what was stored.
        if (json(saved.content) !== JSON.stringify(content)) setDoc(toEditorDoc(saved.content));
        setJustSaved(saved.version);
        router.refresh();
        return saved.version;
      } catch (err) {
        setError(err instanceof Error ? err.message : text("Could not save.", "Opslaan is mislukt."));
        return null;
      } finally {
        setStatus("idle");
      }
    },
    [content, dirty, leadId, locale, router, shownVersion, text],
  );

  async function askAI() {
    if (commentCount === 0) return;
    const base = await save();
    if (base === null) return;
    setStatus("ai");
    setError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/proposal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback: composeSectionFeedback(comments, locale) }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? text("The AI could not create a new version.", "De AI kon geen nieuwe versie maken."));
      }
      setComments({});
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : text("Something went wrong.", "Er is iets misgegaan."));
    } finally {
      setStatus("idle");
    }
  }

  async function finalize() {
    if (commentCount > 0 && !window.confirm(text("You have comments for the AI that you haven't sent. Finalize anyway?", "Je hebt opmerkingen voor de AI die je nog niet hebt verstuurd. Toch definitief maken?"))) {
      return;
    }
    const v = await save();
    if (v === null) return;
    setStatus("finalizing");
    try {
      const res = await fetch(`/api/leads/${leadId}/proposal/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: v }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? text("Could not finalize.", "Definitief maken is mislukt."));
      }
      setComments({});
      router.push(`/leads/${leadId}/dashboard-questions`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : text("Something went wrong.", "Er is iets misgegaan."));
      setStatus("idle");
    }
  }

  async function reopen() {
    const message = isSent
      ? text("This is already marked as sent. Reopening takes the lead back to editing the proposal; the 'Sent' status is cleared until you finish again. Continue?", "Dit is al als verzonden gemarkeerd. Opnieuw openen brengt de lead terug naar het bewerken van het voorstel; de status 'Verzonden' vervalt totdat je opnieuw klaar bent. Doorgaan?")
      : text("Reopen the proposal for editing? You will need to go through the dashboard step again afterwards.", "Het voorstel opnieuw openen om te bewerken? Daarna moet je de dashboardstap opnieuw doorlopen.");
    if (!window.confirm(message)) return;
    setStatus("reopening");
    try {
      const res = await fetch(`/api/leads/${leadId}/proposal/reopen`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? text("Could not reopen.", "Opnieuw openen is mislukt."));
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : text("Something went wrong.", "Er is iets misgegaan."));
    } finally {
      setStatus("idle");
    }
  }

  async function downloadWord() {
    const v = mode === "edit" ? await save() : version.version;
    if (v === null) return;
    window.location.href = `/api/leads/${leadId}/proposal/docx?version=${v}`;
  }

  function discard() {
    setDoc(toEditorDoc(version.content));
    setIssues(null);
    setError(null);
  }

  useEffect(() => {
    if (mode !== "edit") return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, save]);

  const onStats = useCallback((s: { pageCount: number }) => setPageCount(s.pageCount), []);
  const words = countWords(content);
  const sourceLabel = version.source === "manual" ? text("edited manually", "handmatig bewerkt") : version.feedback ? text("AI, with feedback", "AI, met feedback") : text("AI draft", "AI-concept");
  const saveState =
    status === "saving" ? text("Saving…", "Opslaan…") : dirty ? text("Unsaved changes", "Niet-opgeslagen wijzigingen") : text("Saved", "Opgeslagen");

  return (
    <div className="page-stack">
      <div className={["no-print", styles.disclosures].join(" ")}>
        {contextPanel}
        {historyPanel}
      </div>

      <div className={["no-print", styles.messages].join(" ")}>
      {mode === "old" && (
        <StatusBlock tone="neutral">
          {text(`You are viewing v${version.version}, an older version.`, `Je bekijkt v${version.version}, een oudere versie.`)}{" "}
          <Link href={`/leads/${leadId}/proposal`}>{text("Go to the latest version", "Ga naar de nieuwste versie")}</Link>
        </StatusBlock>
      )}
      {mode === "final" && <StatusBlock tone="done">{text(`This proposal is final (v${version.version}).`, `Dit voorstel is definitief (v${version.version}).`)}</StatusBlock>}
      {version.warnings.length > 0 && <StatusBlock tone="attention">{version.warnings.join(" ")}</StatusBlock>}
      {pageCount > 1 && (
        <StatusBlock tone="attention">
          {text(
            `This proposal is ${pageCount} pages. Datavance proposals should fit on one A4 page; shorten the text before sharing it. You can still save, finalize, and export your changes.`,
            `Dit voorstel is ${pageCount} pagina's. Datavance-voorstellen horen op één A4-pagina te passen; kort de tekst in voordat je het deelt. Je kunt je wijzigingen wel opslaan, definitief maken en exporteren.`,
          )}
        </StatusBlock>
      )}
      {conflict !== null && (
        <StatusBlock tone="attention">
          {text(`A newer version exists (v${conflict}).`, `Er bestaat een nieuwere versie (v${conflict}).`)}{" "}
          <button type="button" className={styles.inlineAction} onClick={() => void save(true)}>
            {text("Save my changes anyway", "Mijn wijzigingen toch opslaan")}
          </button>{" "}
          ·{" "}
          <button
            type="button"
            className={styles.inlineAction}
            onClick={() => {
              setConflict(null);
              router.refresh();
            }}
          >
            {text("Load latest version", "Nieuwste versie laden")}
          </button>
        </StatusBlock>
      )}
      {issues && issues.messages.length > 0 && (
        <StatusBlock tone="attention">{issues.messages.join(" ")}</StatusBlock>
      )}
      {error && <StatusBlock tone="attention">{error}</StatusBlock>}
      </div>

      <div className={["no-print", styles.toolbar].join(" ")}>
        <div className={styles.toolbarStatus}>
          <span className={styles.versionLabel}>
            {mode === "final" ? text("Final", "Definitief") : mode === "old" ? text("Older version", "Oudere versie") : text("Draft", "Concept")} · v{version.version}
          </span>
          <span className={styles.meta}>
            {sourceLabel} · {pageCount} {pageCount === 1 ? text("page", "pagina") : text("pages", "pagina's")} · {words} {text("words", "woorden")}
            {mode === "edit" && (
              <>
                {" · "}
                <span className={dirty ? styles.unsaved : undefined}>{saveState}</span>
              </>
            )}
          </span>
          {mode === "edit" && (
            <span className={styles.hint}>
              {text("Click the text to type · Enter = new paragraph · add comments for the AI in the margin", "Klik op de tekst om te typen · Enter = nieuwe alinea · voeg opmerkingen voor de AI toe in de kantlijn")}
            </span>
          )}
        </div>
        <div className={styles.toolbarActions}>
          {mode === "edit" && (
            <>
              {dirty && (
                <button type="button" className={styles.tbLink} onClick={discard} disabled={busy}>
                  {text("Discard", "Verwerpen")}
                </button>
              )}
              <button
                type="button"
                className={[styles.tb, dirty ? styles.tbPrimary : ""].join(" ")}
                onClick={() => void save()}
                disabled={!dirty || busy}
                title="Ctrl+S"
              >
                {text("Save", "Opslaan")}
              </button>
              {demoFeedback && commentCount === 0 && (
                <button
                  type="button"
                  className={styles.tb}
                  onClick={() =>
                    setComments(
                      Object.fromEntries(
                        Object.entries(demoFeedback).filter(([key]) => PROPOSAL_SECTIONS.some((s) => s.key === key)),
                      ),
                    )
                  }
                  disabled={busy}
                >
                  {text("Fill in demo comments", "Demo-opmerkingen invullen")}
                </button>
              )}
              <button
                type="button"
                className={styles.tb}
                onClick={() => void askAI()}
                disabled={commentCount === 0 || busy}
                title={commentCount === 0 ? text("Add a comment in the margin first (hover over a heading)", "Voeg eerst een opmerking toe in de kantlijn (beweeg over een kop)") : undefined}
              >
                {text("Ask AI to revise", "AI laten aanpassen")}{commentCount > 0 ? ` (${commentCount})` : ""}
              </button>
            </>
          )}
          <button type="button" className={styles.tb} onClick={() => void downloadWord()} disabled={busy}>
            Word ↓
          </button>
          <button type="button" className={styles.tb} onClick={() => window.print()} disabled={busy}>
            {text("Print / PDF", "Afdrukken / PDF")}
          </button>
          {mode === "final" && (
            <button type="button" className={styles.tb} onClick={() => void reopen()} disabled={busy}>
              {status === "reopening" ? text("Working…", "Bezig…") : text("Reopen", "Opnieuw openen")}
            </button>
          )}
        </div>
      </div>

      <div className={styles.desk}>
        {status === "ai" && (
          <div className={["no-print", styles.overlay].join(" ")}>
            <div className={styles.overlayCard}>
              {text("The AI is processing your comments…", "De AI verwerkt je opmerkingen…")} {elapsed > 0 ? `${elapsed} s` : ""}
            </div>
          </div>
        )}
        <ProposalDocument
          companyName={companyName}
          dateLabel={dateLabel}
          doc={doc}
          editable={editable}
          onAction={dispatch}
          onFocusRequest={focusField}
          comments={mode === "edit" ? comments : undefined}
          onCommentChange={(key, value) => setComments((c) => ({ ...c, [key]: value }))}
          invalidSections={issues?.sections}
          onStats={onStats}
          fitToPage
        />
      </div>

      <StepActions back={{ href: `/leads/${leadId}/questions`, label: text("Questions", "Vragen") }}>
        {mode === "edit" && (
          <Button onClick={() => void finalize()} disabled={busy}>
            {status === "finalizing" ? text("Working…", "Bezig…") : text("Finalize proposal →", "Voorstel definitief maken →")}
          </Button>
        )}
        {mode === "old" && (
          <LinkButton href={`/leads/${leadId}/proposal`} variant="secondary">
            {text("Go to latest version", "Ga naar de nieuwste versie")}
          </LinkButton>
        )}
        {mode === "final" && (
          <LinkButton href={`/leads/${leadId}/dashboard-questions`}>{text("Continue to dashboard", "Verder naar dashboard")} &rarr;</LinkButton>
        )}
      </StepActions>
    </div>
  );
}
