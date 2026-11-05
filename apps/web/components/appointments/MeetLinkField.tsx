"use client";

import { Input } from "@/components/ui/primitives";

/**
 * Manual Google Meet link input. Chekie does not create calendar events —
 * staff paste the join URL for an online session.
 */
export function MeetLinkField({
  id,
  value,
  onChange,
  error,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  error: string | null;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-bold text-ink-muted" htmlFor={id}>
        Google Meet link
      </label>
      <Input
        id={id}
        type="url"
        inputMode="url"
        placeholder="https://meet.google.com/abc-defg-hij"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
      {error ? (
        <p className="mt-1.5 text-xs font-semibold text-red-600">{error}</p>
      ) : (
        <p className="mt-1.5 text-[11px] font-medium text-ink-faint">
          Paste the meet.google.com link for this online session.
        </p>
      )}
    </div>
  );
}
