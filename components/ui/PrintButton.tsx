"use client";

import { Button } from "./Button";

export function PrintButton() {
  return (
    <div className="no-print" style={{ marginBottom: 16 }}>
      <Button onClick={() => window.print()}>Afdrukken / opslaan als PDF</Button>
    </div>
  );
}
