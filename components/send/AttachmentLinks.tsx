"use client";

import { track } from "@/components/telemetry/track";
import styles from "./AttachmentLinks.module.css";
import { useLanguage } from "@/components/i18n/LanguageProvider";

type Kind = "proposalDocx" | "proposalPdf" | "dashboardPdf" | "dashboardHtml";

const ATTACHMENTS: { kind: Kind; title: string; detail: string; path: (id: string) => string; download: boolean }[] = [
  { kind: "proposalDocx", title: "Proposal", detail: "Word (.docx)", path: (id) => `/api/leads/${id}/proposal/docx?version=final`, download: true },
  { kind: "proposalPdf", title: "Proposal", detail: "PDF via print view", path: (id) => `/leads/${id}/proposal/print`, download: false },
  { kind: "dashboardPdf", title: "PoC dashboard", detail: "PDF via print view", path: (id) => `/leads/${id}/dashboard/print`, download: false },
  { kind: "dashboardHtml", title: "PoC dashboard", detail: "Interactive, works offline (.html)", path: (id) => `/api/leads/${id}/dashboard/export`, download: true },
];

/** The attachments to send, as quiet tiles. Opening one is logged for the evaluation. */
export function AttachmentLinks({ leadId }: { leadId: string }) {
  const { locale } = useLanguage();
  const attachments = locale === "nl" ? [
    { ...ATTACHMENTS[0], title: "Voorstel", detail: "Word (.docx)" },
    { ...ATTACHMENTS[1], title: "Voorstel", detail: "PDF via afdrukweergave" },
    { ...ATTACHMENTS[2], title: "PoC-dashboard", detail: "PDF via afdrukweergave" },
    { ...ATTACHMENTS[3], title: "PoC-dashboard", detail: "Interactief, werkt offline (.html)" },
  ] : ATTACHMENTS;
  return (
    <div className={styles.grid}>
      {attachments.map((a) => (
        <a
          key={a.kind}
          href={a.path(leadId)}
          target={a.download ? undefined : "_blank"}
          rel={a.download ? undefined : "noreferrer"}
          className={styles.tile}
          onClick={() => void track(leadId, { type: "attachment_opened", kind: a.kind })}
        >
          <span className={styles.title}>{a.title}</span>
          <span className={styles.detail}>{a.detail}</span>
        </a>
      ))}
    </div>
  );
}
