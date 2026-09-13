type NotifyType = "appointment" | "referral" | "announcement" | "chat" | "assessment" | "system";

/**
 * Fire-and-forget transaction notification via /api/staff/notify.
 * Never blocks or throws — a missed ping must never break the action itself.
 */
export async function notifyStaff(
  to: (string | null | undefined)[],
  input: { type: NotifyType; title: string; body?: string; link?: string }
): Promise<void> {
  try {
    const targets = [...new Set(to.filter((id): id is string => !!id))];
    if (!targets.length || !input.title.trim()) return;
    await fetch("/api/staff/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: targets, ...input }),
    });
  } catch {
    // Intentionally silent.
  }
}
