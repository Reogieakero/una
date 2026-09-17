"use client";

import { Send } from "lucide-react";
import { Button, Input } from "@/components/ui/primitives";

/**
 * Composer — draft input + send.
 * Extracted verbatim from app/(staff)/chat/page.tsx (JSX/classes unchanged).
 */
export function Composer({
  draft,
  onDraftChange,
  sending,
  onSubmit,
  placeholder,
  inputLabel,
  sendLabel,
}: {
  draft: string;
  onDraftChange: (v: string) => void;
  sending: boolean;
  onSubmit: (e: React.FormEvent) => void;
  placeholder: string;
  inputLabel: string;
  sendLabel: string;
}) {
  return (
    <form onSubmit={onSubmit} className="flex gap-2 border-t border-ink/10 px-4 py-3">
      <Input
        value={draft}
        onChange={(e) => onDraftChange(e.target.value)}
        placeholder={placeholder}
        aria-label={inputLabel}
        disabled={sending}
      />
      <Button disabled={sending || !draft.trim()} aria-label={sendLabel} className="shrink-0 px-4">
        <Send className="h-4 w-4" aria-hidden />
      </Button>
    </form>
  );
}
