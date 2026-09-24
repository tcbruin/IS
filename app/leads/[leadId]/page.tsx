import { redirect } from "next/navigation";
import { getLead } from "@/lib/leadStore";
import { STEP_ROUTES } from "@/lib/workflow";

export default async function LeadPage({
  params,
}: {
  params: Promise<{ leadId: string }>;
}) {
  const { leadId } = await params;
  const lead = await getLead(leadId);
  redirect(`/leads/${leadId}/${STEP_ROUTES[lead.state]}`);
}
