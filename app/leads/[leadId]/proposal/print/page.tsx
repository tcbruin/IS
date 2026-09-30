import { redirect } from "next/navigation";
import { getFinalProposalVersion, getLead } from "@/lib/leadStore";
import { isStateAtLeast } from "@/lib/workflow";
import { toEditorDoc } from "@/lib/proposalDocument";
import { formatDocumentDate } from "@/lib/proposalLayout";
import { ProposalDocument } from "@/components/proposal/ProposalDocument";
import { PrintButton } from "@/components/ui/PrintButton";
import styles from "./page.module.css";
import { getLocale } from "@/lib/i18n-server";

/** Print view of the final proposal — the same A4 pages as on screen; "Save as PDF" in
 * the browser's print dialog gives the PDF attachment. */
export default async function ProposalPrintPage({
  params,
}: {
  params: Promise<{ leadId: string }>;
}) {
  const { leadId } = await params;
  const locale = await getLocale();
  const lead = await getLead(leadId);
  if (!isStateAtLeast(lead.state, "proposal_finalized")) {
    redirect(`/leads/${leadId}`);
  }
  const finalVersion = await getFinalProposalVersion(leadId);

  return (
    <div className={styles.wrap}>
      <div className={["no-print", styles.actions].join(" ")}>
        <PrintButton />
      </div>
      <ProposalDocument
        companyName={lead.companyName}
        dateLabel={formatDocumentDate(finalVersion.createdAt, locale)}
        doc={toEditorDoc(finalVersion.content)}
        editable={false}
      />
    </div>
  );
}
