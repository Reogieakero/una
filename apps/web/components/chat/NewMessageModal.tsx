"use client";

import { Button, Textarea } from "@/components/ui/primitives";
import { Dropdown } from "@/components/shared/dropdown";

/**
 * NewMessageModal — message-a-counselor dialog (head only), reused for the
 * faculty "message the office" dialog via the optional title/description/
 * options overrides.
 * Extracted verbatim from app/(staff)/chat/page.tsx (JSX/classes unchanged).
 */
export function NewMessageModal({
  open,
  onClose,
  counselor,
  onCounselorChange,
  body,
  onBodyChange,
  busy,
  onSend,
  counselorNames,
  openMenuKey,
  onOpenMenuChange,
  title = "Message a counselor",
  description = "Opens a direct conversation shown right in this list.",
  options,
  pickerLabel = "Choose counselor",
}: {
  open: boolean;
  onClose: () => void;
  counselor: string;
  onCounselorChange: (v: string) => void;
  body: string;
  onBodyChange: (v: string) => void;
  busy: boolean;
  onSend: () => void;
  counselorNames: Map<string, string>;
  openMenuKey: string | null;
  onOpenMenuChange: (k: string | null) => void;
  title?: string;
  description?: string;
  /** Explicit recipient options (value = profile id). Defaults to the counselor directory. */
  options?: { value: string; label: string }[];
  pickerLabel?: string;
}) {
  if (!open) return null;
  const recipientOptions =
    options ?? [...counselorNames.entries()].map(([id, name]) => ({ value: id, label: name }));
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="msg-counselor-title"
    >
      <div aria-hidden className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-lg bg-white p-6 shadow-card">
        <h2 id="msg-counselor-title" className="font-display text-lg font-bold text-ink">
          {title}
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-muted">
          {description}
        </p>
        <div className="mt-4 space-y-3">
          <Dropdown
            menuKey="msg-counselor"
            openMenuKey={openMenuKey}
            onOpenChange={onOpenMenuChange}
            value={counselor}
            onChange={onCounselorChange}
            ariaLabel={pickerLabel}
            options={recipientOptions}
          />
          <Textarea
            rows={4}
            value={body}
            onChange={(e) => onBodyChange(e.target.value)}
            placeholder="Write your message…"
            aria-label="Message"
            maxLength={2000}
          />
          <p className="text-right text-[11px] font-medium text-ink-faint">{body.trim().length}/2000</p>
        </div>
        <div className="mt-2 flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={onClose} autoFocus>
            Back
          </Button>
          <Button size="sm" variant="primary" disabled={busy || !counselor || !body.trim()} onClick={onSend}>
            {busy ? "Sending…" : "Send message"}
          </Button>
        </div>
      </div>
    </div>
  );
}
