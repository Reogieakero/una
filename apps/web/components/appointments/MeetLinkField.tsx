"use client";

import { Button, Input } from "@/components/ui/primitives";

export function MeetLinkField({
  id,
  value,
  onChange,
  error,
  disabled,
  managed,
  createBusy,
  onCreate,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  error: string | null;
  disabled?: boolean;
  managed?: boolean;
  createBusy?: boolean;
  onCreate?: () => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-bold text-ink-muted" htmlFor={id}>
        Google Meet link
      </label>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          id={id}
          type="url"
          inputMode="url"
          placeholder="https://meet.google.com/abc-defg-hij"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
        {onCreate ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled || createBusy}
            onClick={onCreate}
            className="shrink-0"
          >
            {createBusy ? "Creating…" : "Create Meet link"}
          </Button>
        ) : null}
      </div>
      {error ? (
        <p className="mt-1.5 text-xs font-semibold text-red-600">{error}</p>
      ) : managed ? (
        <p className="mt-1.5 text-[11px] font-medium text-ink-faint">Created by Chekie. You can still paste a different link if you prefer.</p>
      ) : (
        <p className="mt-1.5 text-[11px] font-medium text-ink-faint">
          Chekie can create the Meet link for you. You can still paste one if you prefer.
        </p>
      )}
    </div>
  );
}
