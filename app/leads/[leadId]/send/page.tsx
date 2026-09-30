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
import { getLocale } from "@/lib/i18n-server";
import { localeTag, pick } from "@/lib/i18n";

export default async function SendPage({ params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  const locale = await getLocale();
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
      <StepIntro title={pick(locale, "Send", "Versturen")}>
        {pick(locale, "Download the attachments, copy the email into your mail client, then mark as sent.", "Download de bijlagen, kopieer de e-mail naar je e-mailprogramma en markeer daarna als verzonden.")}
      </StepIntro>

      <Card>
        <h3 className={styles.sectionTitle}>
          <span className={styles.number}>1</span> {pick(locale, "Attachments", "Bijlagen")}
        </h3>
        <AttachmentLinks leadId={leadId} />
      </Card>

      <Card>
        <h3 className={styles.sectionTitle}>
          <span className={styles.number}>2</span> {pick(locale, "Cover email", "Begeleidende e-mail")}
        </h3>
        <CoverEmailPanel leadId={leadId} initialEmail={coverEmail} />
      </Card>

      <Card>
        <h3 className={styles.sectionTitle}>
          <span className={styles.number}>3</span> {pick(locale, "Finish", "Afronden")}
        </h3>
        {isSent ? (
          <StatusBlock tone="done">
            {pick(locale, "Sent", "Verzonden")}{sentAt ? ` ${pick(locale, "on", "op")} ${new Date(sentAt).toLocaleDateString(localeTag(locale))}` : ""}.
          </StatusBlock>
        ) : (
          <p className={styles.muted}>
            {pick(locale, "The app does not send anything itself — mark as sent once you have emailed it to the client.", "De app verstuurt zelf niets — markeer als verzonden zodra je het naar de klant hebt gemaild.")}
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
          <GenerateButton url={`/api/leads/${leadId}/send`} label={pick(locale, "Mark as sent", "Markeren als verzonden")} busyLabel={pick(locale, "Working...", "Bezig...")} />
        )}
      </StepActions>
    </div>
  );
}
