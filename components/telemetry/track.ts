import type { ClientEvent } from "@/lib/telemetryEvents";

/** Fire-and-forget client telemetry. Never throws — evaluation data must not break the UI. */
export function track(leadId: string, event: ClientEvent): Promise<void> {
  return fetch(`/api/leads/${leadId}/events`, {
    method: "POST",
    body: JSON.stringify(event),
    keepalive: true,
  })
    .then(() => undefined)
    .catch(() => undefined);
}
