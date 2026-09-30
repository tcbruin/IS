import { Hero } from "@/components/ui/Hero";
import { Card } from "@/components/ui/Card";
import { UploadForm } from "@/components/upload/UploadForm";
import { getLocale } from "@/lib/i18n-server";
import { pick } from "@/lib/i18n";

export default async function NewLeadPage() {
  const locale = await getLocale();
  return (
    <div style={{ maxWidth: 640, margin: "40px auto", padding: "0 20px" }}>
      <Hero title={pick(locale, "New lead", "Nieuwe lead")} subtitle={pick(locale, "Upload a transcribed sales call to get started.", "Upload een uitgeschreven verkoopgesprek om te beginnen.")} />
      <div style={{ marginTop: 24 }}>
        <Card>
          <UploadForm />
        </Card>
      </div>
    </div>
  );
}
