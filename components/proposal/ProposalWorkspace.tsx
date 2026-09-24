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
import { PROPOSAL_SECTIONS, composeSectionFeedback } from "@/lib/proposalSections";
import { proposalContentSchema, type ProposalContent, type ProposalVersion } from "@/lib/validation";
import { Button, LinkButton } from "@/components/ui/Button";
import { StatusBlock } from "@/components/ui/StatusBlock";
import { StepActions } from "@/components/ui/StepActions";
import { ProposalDocument, type Comments } from "./ProposalDocument";
import { useUnsavedChangesGuard } from "./useUnsavedChangesGuard";
import styles from "./ProposalWorkspace.module.css";

type Mode = "edit" | "old" | "final";
type Status = "idle" | "saving" | "ai" | "finalizing" | "reopening";

const FIELD_LABELS: Record<string, string> = {
  coverIntro: "Introductie",
  ...Object.fromEntries(PROPOSAL_SECTIONS.map((s) => [s.key, s.label])),
};

function describeIssues(content: ProposalContent): { sections: Set<string>; messages: string[] } {
  const result = proposalContentSchema.safeParse(content);
  const sections = new Set<string>();
  const messages: string[] = [];
  if (result.success) return { sections, messages };
  for (const issue of result.error.issues) {
    const field = String(issue.path[0]);
    sections.add(field);
    if (field === "timeline" && typeof issue.path[2] === "number") {
      const part = issue.path[3] === "name" ? "naam" : "beschrijving";
      messages.push(`Tijdlijn: fase ${issue.path[2] + 1} heeft nog geen ${part}.`);
    } else {
      messages.push(`${FIELD_LABELS[field] ?? field} is nog leeg.`);
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
      const found = describeIssues(content);
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
        if (!res.ok) throw new Error(body.error ?? "Opslaan mislukt.");
        const saved = body as ProposalVersion;
        setConflict(null);
        setBaseline(json(saved.content));
        // Guardrails may have fixed something (e.g. brand spelling) — show what was stored.
        if (json(saved.content) !== JSON.stringify(content)) setDoc(toEditorDoc(saved.content));
        setJustSaved(saved.version);
        router.refresh();
        return saved.version;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Opslaan mislukt.");
        return null;
      } finally {
        setStatus("idle");
      }
    },
    [content, dirty, leadId, router, shownVersion],
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
        body: JSON.stringify({ feedback: composeSectionFeedback(comments) }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "De AI kon geen nieuwe versie maken.");
      }
      setComments({});
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Er ging iets mis.");
    } finally {
      setStatus("idle");
    }
  }

  async function finalize() {
    if (commentCount > 0 && !window.confirm("Er staan nog opmerkingen voor de AI die je niet hebt verstuurd. Toch definitief maken?")) {
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
        throw new Error(body.error ?? "Definitief maken mislukt.");
      }
      setComments({});
      router.push(`/leads/${leadId}/dashboard-questions`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Er ging iets mis.");
      setStatus("idle");
    }
  }

  async function reopen() {
    const message = isSent
      ? "Dit is al gemarkeerd als verzonden. Heropenen zet de lead terug naar het bewerken van het voorstel; de status 'Verzonden' vervalt tot je opnieuw afrondt. Doorgaan?"
      : "Het voorstel heropenen om het te bewerken? Het dashboard moet daarna opnieuw doorlopen worden.";
    if (!window.confirm(message)) return;
    setStatus("reopening");
    try {
      const res = await fetch(`/api/leads/${leadId}/proposal/reopen`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Heropenen mislukt.");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Er ging iets mis.");
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
  const sourceLabel = version.source === "manual" ? "handmatig bewerkt" : version.feedback ? "AI, met feedback" : "AI-concept";
  const saveState =
    status === "saving" ? "Opslaan…" : dirty ? "Niet-opgeslagen wijzigingen" : "Opgeslagen";

  return (
    <div className="page-stack">
      <div className={["no-print", styles.disclosures].join(" ")}>
        {contextPanel}
        {historyPanel}
      </div>

      <div className={["no-print", styles.messages].join(" ")}>
      {mode === "old" && (
        <StatusBlock tone="neutral">
          Je bekijkt v{version.version}, een oudere versie.{" "}
          <Link href={`/leads/${leadId}/proposal`}>Naar de laatste versie</Link>
        </StatusBlock>
      )}
      {mode === "final" && <StatusBlock tone="done">Dit voorstel is definitief (v{version.version}).</StatusBlock>}
      {version.warnings.length > 0 && <StatusBlock tone="attention">{version.warnings.join(" ")}</StatusBlock>}
      {conflict !== null && (
        <StatusBlock tone="attention">
          Er is intussen een nieuwere versie (v{conflict}).{" "}
          <button type="button" className={styles.inlineAction} onClick={() => void save(true)}>
            Mijn wijzigingen toch opslaan
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
            Nieuwste versie laden
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
            {mode === "final" ? "Definitief" : mode === "old" ? "Oudere versie" : "Concept"} · v{version.version}
          </span>
          <span className={styles.meta}>
            {sourceLabel} · {pageCount} {pageCount === 1 ? "pagina" : "pagina's"} · {words} woorden
            {mode === "edit" && (
              <>
                {" · "}
                <span className={dirty ? styles.unsaved : undefined}>{saveState}</span>
              </>
            )}
          </span>
          {mode === "edit" && (
            <span className={styles.hint}>
              Klik in de tekst om te typen · Enter = nieuwe alinea · opmerkingen voor de AI zet je in de kantlijn
            </span>
          )}
        </div>
        <div className={styles.toolbarActions}>
          {mode === "edit" && (
            <>
              {dirty && (
                <button type="button" className={styles.tbLink} onClick={discard} disabled={busy}>
                  Verwerpen
                </button>
              )}
              <button
                type="button"
                className={[styles.tb, dirty ? styles.tbPrimary : ""].join(" ")}
                onClick={() => void save()}
                disabled={!dirty || busy}
                title="Ctrl+S"
              >
                Opslaan
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
                  Demo-opmerkingen invullen
                </button>
              )}
              <button
                type="button"
                className={styles.tb}
                onClick={() => void askAI()}
                disabled={commentCount === 0 || busy}
                title={commentCount === 0 ? "Zet eerst een opmerking in de kantlijn (hover een kop)" : undefined}
              >
                Vraag AI om aanpassing{commentCount > 0 ? ` (${commentCount})` : ""}
              </button>
            </>
          )}
          <button type="button" className={styles.tb} onClick={() => void downloadWord()} disabled={busy}>
            Word ↓
          </button>
          <button type="button" className={styles.tb} onClick={() => window.print()} disabled={busy}>
            Afdrukken / PDF
          </button>
          {mode === "final" && (
            <button type="button" className={styles.tb} onClick={() => void reopen()} disabled={busy}>
              {status === "reopening" ? "Bezig…" : "Heropenen"}
            </button>
          )}
        </div>
      </div>

      <div className={styles.desk}>
        {status === "ai" && (
          <div className={["no-print", styles.overlay].join(" ")}>
            <div className={styles.overlayCard}>
              De AI verwerkt je opmerkingen… {elapsed > 0 ? `${elapsed} s` : ""}
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
        />
      </div>

      <StepActions back={{ href: `/leads/${leadId}/questions`, label: "Vragen" }}>
        {mode === "edit" && (
          <Button onClick={() => void finalize()} disabled={busy}>
            {status === "finalizing" ? "Bezig…" : "Definitief maken →"}
          </Button>
        )}
        {mode === "old" && (
          <LinkButton href={`/leads/${leadId}/proposal`} variant="secondary">
            Naar laatste versie
          </LinkButton>
        )}
        {mode === "final" && (
          <LinkButton href={`/leads/${leadId}/dashboard-questions`}>Verder naar dashboard &rarr;</LinkButton>
        )}
      </StepActions>
    </div>
  );
}
