"use client";

import { Button } from "./Button";

export function PrintButton() {
  return (
    <div className="no-print" style={{ marginBottom: 16 }}>
      <Button onClick={() => window.print()}>Print / save as PDF</Button>
    </div>
  );
}
