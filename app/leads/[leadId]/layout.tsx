import { notFound } from "next/navigation";
import { getLead, NotFoundError } from "@/lib/leadStore";
import { LeadHeader } from "@/components/ui/LeadHeader";
import { DeleteLeadButton } from "@/components/ui/DeleteLeadButton";
import { ActivityTracker } from "@/components/telemetry/ActivityTracker";
import { ReportIssueButton } from "@/components/telemetry/ReportIssueButton";
import { SnapshotButton } from "@/components/demo/DemoControls";
import { isStateAtLeast } from "@/lib/workflow";
import styles from "./layout.module.css";

export default async function LeadLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ leadId: string }>;
}) {
  const { leadId } = await params;

  const lead = await getLead(leadId).catch((err) => {
    if (err instanceof NotFoundError) return null;
    throw err;
  });
  if (!lead) notFound();

  return (
    <div className={styles.page}>
      <LeadHeader
        lead={{
          id: lead.id,
          companyName: lead.companyName,
          leadName: lead.leadName,
          sourceSystem: lead.sourceSystem,
          state: lead.state,
          demo: lead.demo,
        }}
        actions={<ReportIssueButton leadId={leadId} />}
        menu={
          <>
            {lead.demo?.mode === "live" && isStateAtLeast(lead.state, "dashboard_generated") && (
              <SnapshotButton leadId={leadId} />
            )}
            <DeleteLeadButton leadId={leadId} />
          </>
        }
      />
      <ActivityTracker leadId={leadId} />
      {children}
    </div>
  );
}
