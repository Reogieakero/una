export type EmergencyIdentity = {
  fullName: string | null;
  email: string | null;
  studentNo: string;
  program: string | null;
  yearLevel: string | null;
  college: string | null;
  contactNo: string | null;
  alias: string | null;
};

/** Revealed-identity panel — audit notice plus the identity rows. */
export function IdentityCard({ identity }: { identity: EmergencyIdentity }) {
  const idRows: [string, string | null][] = [
    ["Full name", identity.fullName],
    ["Email", identity.email],
    ["Student no.", identity.studentNo],
    ["Program", identity.program],
    ["Year level", identity.yearLevel],
    ["College", identity.college],
    ["Contact no.", identity.contactNo],
  ];
  return (
    <div className="mt-3 space-y-3">
      <div className="rounded-lg bg-red-50 px-4 py-2.5 text-[13px] font-semibold text-red-800 ring-1 ring-red-200">
        This view was audit-logged under your name. Handle these details with care.
      </div>
      <dl className="divide-y divide-ink/10 rounded-lg border border-ink/10">
        {idRows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
            <dt className="font-medium text-ink-muted">{k}</dt>
            <dd className="truncate font-bold text-ink">{v ?? "—"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
