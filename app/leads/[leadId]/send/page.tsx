import { redirect } from "next/navigation";
import { getCoverEmail, getLead } from "@/lib/leadStore";
import { isStateAtLeast } from "@/lib/workflow";
import { Card } from "@/components/ui/Card";
import { GenerateButton } from "@/components/ui/GenerateButton";
import { StatusBlock } from "@/components/ui/StatusBlock";
import { StepActions } from "@/components/ui/StepActions";
import { StepIntro } from "@/components/ui/StepIntro";
import { AttachmentLinks } from "@/components/send/AttachmentLinks";
import { CoverEmailPanel } from "@/components/send/CoverEmailPanel";
import { RetroCard } from "@/components/telemetry/RetroCard";
import { readEvents } from "@/lib/telemetry";
import { getSettings } from "@/lib/settings";
import styles from "./page.module.css";

export default async function SendPage({ params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  const lead = await getLead(leadId);

  if (!isStateAtLeast(lead.state, "dashboard_generated")) {
    redirect(`/leads/${leadId}`);
  }

  const [coverEmail, events, settings] = await Promise.all([getCoverEmail(leadId), readEvents(leadId), getSettings()]);
  const ratings: Record<string, number> = {};
  let ownEstimate: number | null = null;
  for (const e of events) {
    if (e.type === "rating") ratings[e.artifact] = e.score;
    if (e.type === "baseline_estimate") ownEstimate = e.minutes;
  }
  const sentAt = lead.stateHistory.findLast((h) => h.state === "sent")?.at;
  const isSent = lead.state === "sent";

  return (
    <div className="page-stack">
      <StepIntro title="Versturen">
        Download de bijlagen, kopieer de e-mail naar je mailprogramma en markeer daarna als verzonden.
      </StepIntro>

      <Card>
        <h3 className={styles.sectionTitle}>
          <span className={styles.number}>1</span> Bijlagen
        </h3>
        <AttachmentLinks leadId={leadId} />
      </Card>

      <Card>
        <h3 className={styles.sectionTitle}>
          <span className={styles.number}>2</span> Begeleidende e-mail
        </h3>
        <CoverEmailPanel leadId={leadId} initialEmail={coverEmail} />
      </Card>

      <Card>
        <h3 className={styles.sectionTitle}>
          <span className={styles.number}>3</span> Afronden
        </h3>
        {isSent ? (
          <StatusBlock tone="done">
            Verzonden{sentAt ? ` op ${new Date(sentAt).toLocaleDateString("nl-NL")}` : ""}.
          </StatusBlock>
        ) : (
          <p className={styles.muted}>
            De app verstuurt zelf niets — markeer als verzonden zodra jij het naar de klant hebt gemaild.
          </p>
        )}
      </Card>

      <Card variant={isSent ? "creme" : "light"}>
        <RetroCard
          leadId={leadId}
          initialRatings={ratings}
          initialEstimate={ownEstimate}
          defaultEstimate={settings.baselineMinutesPerLead}
        />
      </Card>

      <StepActions back={{ href: `/leads/${leadId}/dashboard`, label: "Dashboard" }}>
        {!isSent && (
          <GenerateButton url={`/api/leads/${leadId}/send`} label="Markeer als verzonden" busyLabel="Bezig..." />
        )}
      </StepActions>
    </div>
  );
}
