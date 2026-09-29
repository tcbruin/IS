import { Hero } from "@/components/ui/Hero";
import { Card } from "@/components/ui/Card";
import { UploadForm } from "@/components/upload/UploadForm";

export default function NewLeadPage() {
  return (
    <div style={{ maxWidth: 640, margin: "40px auto", padding: "0 20px" }}>
      <Hero title="New lead" subtitle="Upload a transcribed sales call to get started." />
      <div style={{ marginTop: 24 }}>
        <Card>
          <UploadForm />
        </Card>
      </div>
    </div>
  );
}
