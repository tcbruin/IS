import Link from "next/link";
import { listLeads } from "@/lib/leadStore";
import { describeStatus } from "@/lib/workflow";
import { formatRelativeTime } from "@/lib/formatRelativeTime";
import type { Lead } from "@/lib/validation";
import { Hero } from "@/components/ui/Hero";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { StepIndicator } from "@/components/ui/StepIndicator";
import styles from "./page.module.css";
import { getLocale } from "@/lib/i18n-server";
import { pick, type Locale } from "@/lib/i18n";

function LeadCard({ lead, locale }: { lead: Lead; locale: Locale }) {
  return (
    <Link href={`/leads/${lead.id}`} className={styles.cardLink}>
      <Card>
        <div className={styles.row}>
          <div>
            <div className={styles.company}>
              {lead.companyName}
              {lead.demo && <span className={styles.demoBadge}>Demo</span>}
            </div>
            {lead.leadName && <div className={styles.leadName}>{lead.leadName}</div>}
          </div>
          <div className={styles.progressCol}>
            <StepIndicator state={lead.state} leadId={lead.id} interactive={false} size="compact" />
            <div className={styles.meta}>
              <span className={styles.stateLabel}>{describeStatus(lead.state, locale)}</span>
              <span>{formatRelativeTime(lead.updatedAt, new Date(), locale)}</span>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}

export default async function HomePage() {
  const [leads, locale] = await Promise.all([listLeads(), getLocale()]);
  const realLeads = leads.filter((l) => !l.demo);
  const demoLeads = leads.filter((l) => l.demo);

  return (
    <div className={styles.page}>
      <Hero
        title={pick(locale, "Proposal & PoC Dashboard Generator", "Voorstel- & PoC-dashboardgenerator")}
        subtitle={pick(locale, "From sales call to proposal and proof-of-concept dashboard, in the Datavance house style.", "Van verkoopgesprek naar voorstel en proof-of-conceptdashboard, in de huisstijl van Datavance.")}
      />

      <div className={styles.headerRow}>
        <h2>{pick(locale, "Leads", "Leads")}</h2>
        <div className={styles.headerLinks}>
          <Link href="/demo" className={styles.quietLink}>
            Demo
          </Link>
          <Link href="/evaluation" className={styles.quietLink}>
            {pick(locale, "Evaluation", "Evaluatie")}
          </Link>
          <LinkButton href="/leads/new">{pick(locale, "+ New lead", "+ Nieuwe lead")}</LinkButton>
        </div>
      </div>

      {realLeads.length === 0 ? (
        <Card>
          <p className={styles.empty}>{pick(locale, "No leads yet. Upload a transcript to get started.", "Nog geen leads. Upload een transcript om te beginnen.")}</p>
        </Card>
      ) : (
        <div className={styles.list}>
          {realLeads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} locale={locale} />
          ))}
        </div>
      )}

      {demoLeads.length > 0 && (
        <>
          <h3 className={styles.subheading}>{pick(locale, "Demos", "Demo's")}</h3>
          <div className={styles.list}>
            {demoLeads.map((lead) => (
              <LeadCard key={lead.id} lead={lead} locale={locale} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
