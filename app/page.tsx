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

function LeadCard({ lead }: { lead: Lead }) {
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
              <span className={styles.stateLabel}>{describeStatus(lead.state)}</span>
              <span>{formatRelativeTime(lead.updatedAt)}</span>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}

export default async function HomePage() {
  const leads = await listLeads();
  const realLeads = leads.filter((l) => !l.demo);
  const demoLeads = leads.filter((l) => l.demo);

  return (
    <div className={styles.page}>
      <Hero
        title="Voorstel & PoC Dashboard Generator"
        subtitle="Van salesgesprek naar voorstel en proof-of-concept dashboard, in Datavance huisstijl."
      />

      <div className={styles.headerRow}>
        <h2>Leads</h2>
        <div className={styles.headerLinks}>
          <Link href="/demo" className={styles.quietLink}>
            Demo
          </Link>
          <Link href="/evaluatie" className={styles.quietLink}>
            Evaluatie
          </Link>
          <LinkButton href="/leads/new">+ Nieuwe lead</LinkButton>
        </div>
      </div>

      {realLeads.length === 0 ? (
        <Card>
          <p className={styles.empty}>Nog geen leads. Upload een transcript om te beginnen.</p>
        </Card>
      ) : (
        <div className={styles.list}>
          {realLeads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} />
          ))}
        </div>
      )}

      {demoLeads.length > 0 && (
        <>
          <h3 className={styles.subheading}>Demo&apos;s</h3>
          <div className={styles.list}>
            {demoLeads.map((lead) => (
              <LeadCard key={lead.id} lead={lead} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
