import { redirect } from "next/navigation";
import { LegacyDashboardError, getDashboard, getLead } from "@/lib/leadStore";
import { isStateAtLeast } from "@/lib/workflow";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { PrintButton } from "@/components/ui/PrintButton";
import styles from "./page.module.css";

/** Print view: "Save as PDF" gives a single page exactly the size of the canvas. */
export default async function DashboardPrintPage({
  params,
}: {
  params: Promise<{ leadId: string }>;
}) {
  const { leadId } = await params;
  const lead = await getLead(leadId);
  if (!isStateAtLeast(lead.state, "dashboard_generated")) {
    redirect(`/leads/${leadId}`);
  }
  const record = await getDashboard(leadId).catch((err) => {
    if (err instanceof LegacyDashboardError) return null;
    throw err;
  });
  if (!record) redirect(`/leads/${leadId}/dashboard`);

  return (
    <div className={styles.wrap}>
      <div className="no-print">
        <PrintButton />
      </div>
      <DashboardView record={record} companyName={lead.companyName} />
      <p className={["no-print", styles.note].join(" ")}>
        All figures are illustrative sample data, not real data from {lead.companyName}.
      </p>
    </div>
  );
}
