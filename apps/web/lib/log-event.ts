/**
 * Structured operational logging for the mutation / realtime /
 * notification pipeline.
 *
 * Events: MUTATION_STARTED/SUCCESS/FAILED, REALTIME_EVENT_PUBLISHED/RECEIVED,
 * NOTIFICATION_CREATED/DELIVERED/FAILED, AUDIT_FAILED, CHAT_SEND_FAILED,
 * SUBSCRIPTION_CONNECTED/DISCONNECTED/RECONNECTING/RECONNECTED.
 *
 * PRIVACY CONTRACT — fields must carry ids, roles, links, counts, and
 * durations ONLY. Never pass titles, bodies, reasons, aliases, or any
 * student/user content: notification titles themselves can contain reason
 * excerpts, so they are deliberately not loggable here.
 *
 * Dev writes to the console; production is silent unless a sink is installed
 * via setLogSink (e.g. aserver log drain or analytics endpoint).
 */

export type StructuredEvent =
  | "MUTATION_STARTED"
  | "MUTATION_SUCCESS"
  | "MUTATION_FAILED"
  | "REALTIME_EVENT_PUBLISHED"
  | "REALTIME_EVENT_RECEIVED"
  | "NOTIFICATION_CREATED"
  | "NOTIFICATION_DELIVERED"
  | "NOTIFICATION_FAILED"
  | "AUDIT_FAILED"
  | "CHAT_SEND_FAILED"
  | "SUBSCRIPTION_CONNECTED"
  | "SUBSCRIPTION_DISCONNECTED"
  | "SUBSCRIPTION_RECONNECTING"
  | "SUBSCRIPTION_RECONNECTED";

export type LogFields = Record<string, string | number | boolean | null | undefined>;

export type LogSink = (type: StructuredEvent, fields: LogFields) => void;

let sink: LogSink | null = null;

/** Install (or clear) a production log drain. */
export function setLogSink(next: LogSink | null): void {
  sink = next;
}

const devEnabled =
  typeof process !== "undefined" && process.env?.NODE_ENV !== "production";

export function logEvent(type: StructuredEvent, fields: LogFields = {}): void {
  const entry: LogFields = { ts: new Date().toISOString(), ...fields };
  if (sink) {
    try {
      sink(type, entry);
    } catch {
      // Logging must never break the action it observes.
    }
    return;
  }
  if (devEnabled) {
    console.debug(`[dorsu:${type}]`, entry);
  }
}
