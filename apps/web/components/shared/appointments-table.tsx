import type { AppointmentRow } from "@dorsu/shared-types";
import { Badge, Card } from "@/components/ui/primitives";

/** Presentational appointments table — no fetching or rules, props in only. */
export function AppointmentsTable({ rows }: { rows: AppointmentRow[] }) {
  if (!rows.length) {
    return (
      <Card>
        <p className="text-sm text-ink-muted">No appointments yet.</p>
      </Card>
    );
  }
  const tone = (s: string) =>
    s === "completed"
      ? "success"
      : s === "cancelled" || s === "rejected" || s === "no_show"
        ? "danger"
        : s === "assigned" || s === "confirmed"
          ? "info"
          : "warning";
  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-ink/10 text-xs uppercase text-ink-muted">
            <th className="px-4 py-3">When</th>
            <th className="px-4 py-3">Mode</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Concern</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id} className="border-b border-ink/5 last:border-0">
              <td className="px-4 py-3">{new Date(a.scheduled_at).toLocaleString()}</td>
              <td className="px-4 py-3">{a.mode === "online" ? "Online" : "In person"}</td>
              <td className="px-4 py-3">
                <Badge tone={tone(a.status) as "info"}>{a.status}</Badge>
              </td>
              <td className="max-w-xs truncate px-4 py-3">{a.concern}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
