export type MeetLinkResponse = {
  meetingUrl: string;
  provider: "google_meet" | "manual";
  created: boolean;
  eventId?: string | null;
  persisted?: boolean;
};

export const MEET_CREATE_FALLBACK =
  "Couldn't create a Meet link — paste one instead or try again.";

async function readError(res: Response): Promise<string> {
  const json = (await res.json().catch(() => null)) as { error?: string } | null;
  return json?.error || MEET_CREATE_FALLBACK;
}

export async function requestMeetCreate(body: {
  appointmentId?: string;
  referralId?: string;
  scheduledAt?: string;
  endsAt?: string | null;
}): Promise<MeetLinkResponse> {
  const res = await fetch("/api/appointments/meet", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 503) {
    throw new Error(MEET_CREATE_FALLBACK);
  }
  if (!res.ok) {
    throw new Error(await readError(res));
  }
  return (await res.json()) as MeetLinkResponse;
}

export async function requestMeetCleanup(appointmentId: string): Promise<void> {
  const res = await fetch("/api/appointments/meet", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appointmentId }),
  });
  if (res.ok || res.status === 404 || res.status === 409) return;
  throw new Error(await readError(res));
}

export async function requestMeetReschedule(
  appointmentId: string,
  scheduledAt: string,
  endsAt: string | null,
): Promise<void> {
  const res = await fetch("/api/appointments/meet", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appointmentId, scheduledAt, endsAt }),
  });
  if (res.ok || res.status === 404) return;
  if (res.status === 503) return;
  throw new Error(await readError(res));
}
