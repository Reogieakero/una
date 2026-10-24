import { NextResponse } from "next/server";
import { appointmentMeetSchema } from "@dorsu/shared-schemas";
import {
  isMeetUrl,
  meetingCreateAllowed,
  meetingPatchAllowed,
  meetingRemoveAllowed,
} from "@dorsu/shared-services";
import {
  createCounselingMeetEvent,
  deleteCounselingMeetEvent,
  GoogleMeetError,
  isGoogleMeetConfigured,
  patchCounselingMeetEvent,
} from "@/lib/google/meet";
import { clientIp, hitRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

/**
 * /api/appointments/meet — create / patch / delete a Google Meet link.
 *
 * Secrets stay on the server. The Calendar event has a generic title and no
 * attendees. Audit rows carry appointment id + provider + outcome only.
 */

const APPT_SELECT =
  "id, counselor_id, mode, status, scheduled_at, ends_at, meeting_url, meeting_provider, meeting_event_id";

type ApptRow = {
  id: string;
  counselor_id: string | null;
  mode: string;
  status: string;
  scheduled_at: string;
  ends_at: string | null;
  meeting_url: string | null;
  meeting_provider: string | null;
  meeting_event_id: string | null;
};

type Caller = { id: string; role: string; counselorId: string | null };

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function asGoogleError(err: unknown): NextResponse {
  if (err instanceof GoogleMeetError) {
    return jsonError(err.message, err.httpStatus);
  }
  return jsonError("Couldn't create a Meet link — paste one instead or try again.", 502);
}

async function loadCaller(): Promise<{ caller: Caller | null; status: number; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { caller: null, status: 401, error: "Sign in required." };

  const { data: profile } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).single();
  const role = (profile as { role?: string; is_active?: boolean | null } | null)?.role;
  if (!profile || (profile as { is_active?: boolean | null }).is_active === false) {
    return { caller: null, status: 403, error: "This account isn't active." };
  }
  if (role !== "counselor" && role !== "guidance_head") {
    return { caller: null, status: 403, error: "Only counselors and the guidance head can manage Meet links." };
  }
  let counselorId: string | null = null;
  if (role === "counselor") {
    const { data: row } = await supabase.from("counselors").select("id").eq("profile_id", user.id).maybeSingle();
    counselorId = (row as { id: string } | null)?.id ?? null;
    if (!counselorId) return { caller: null, status: 403, error: "No counselor profile is linked to this account." };
  }
  return { caller: { id: user.id, role, counselorId }, status: 200 };
}

function canAccessAppointment(caller: Caller, appt: ApptRow): boolean {
  if (caller.role === "guidance_head") return true;
  return Boolean(caller.counselorId && appt.counselor_id === caller.counselorId);
}

async function audit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  callerId: string,
  action: string,
  appointmentId: string,
  outcome: string,
) {
  await supabase.from("audit_logs").insert({
    actor_profile_id: callerId,
    action,
    entity: "appointments",
    entity_id: appointmentId,
    metadata: { provider: "google_meet", outcome },
  });
}

function persistPatch(meetingUrl: string, eventId: string) {
  return {
    meeting_url: meetingUrl,
    meeting_provider: "google_meet" as const,
    meeting_event_id: eventId,
    meeting_created_at: new Date().toISOString(),
  };
}

const CLEAR_PATCH: {
  meeting_url: null;
  meeting_provider: "manual";
  meeting_event_id: null;
  meeting_created_at: null;
} = {
  meeting_url: null,
  meeting_provider: "manual",
  meeting_event_id: null,
  meeting_created_at: null,
};

export async function POST(request: Request) {
  const parsed = appointmentMeetSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid input.", 400);
  }
  if (!isGoogleMeetConfigured()) {
    return jsonError("Chekie isn't set up to create Meet links yet — paste one instead.", 503);
  }

  const limited = hitRateLimit(`meet-create:${clientIp(request)}`, 10, 60_000);
  if (limited.limited) {
    return jsonError("Too many Meet requests — wait a moment and try again.", 429);
  }

  const loaded = await loadCaller();
  if (!loaded.caller) return jsonError(loaded.error ?? "Forbidden.", loaded.status);
  const caller = loaded.caller;
  const supabase = await createClient();

  try {
    if (parsed.data.appointmentId) {
      return await createForAppointment(supabase, caller, parsed.data.appointmentId, parsed.data.scheduledAt, parsed.data.endsAt);
    }
    return await createForReferral(supabase, caller, parsed.data.referralId as string, parsed.data.scheduledAt, parsed.data.endsAt);
  } catch (err) {
    return asGoogleError(err);
  }
}

async function createForAppointment(
  supabase: Awaited<ReturnType<typeof createClient>>,
  caller: Caller,
  appointmentId: string,
  scheduledAt: string | undefined,
  endsAt: string | null | undefined,
) {
  const { data, error } = await supabase.from("appointments").select(APPT_SELECT).eq("id", appointmentId).maybeSingle();
  if (error || !data) return jsonError("Session not found.", 404);
  const appt = data as ApptRow;
  if (!canAccessAppointment(caller, appt)) {
    return jsonError("You can only create a Meet link for your own sessions.", 403);
  }

  if (appt.meeting_url && appt.meeting_provider === "google_meet" && isMeetUrl(appt.meeting_url)) {
    return NextResponse.json({
      meetingUrl: appt.meeting_url,
      provider: "google_meet",
      created: false,
      eventId: appt.meeting_event_id,
      persisted: true,
    });
  }
  if (appt.meeting_url) {
    return jsonError("This session already has a Meet link. Remove it first to create a new one.", 409);
  }

  const startIso = scheduledAt ?? appt.scheduled_at;
  if (!meetingCreateAllowed(appt.status, appt.mode, startIso)) {
    return jsonError("Meet links can only be created for upcoming online sessions that are assigned or confirmed.", 422);
  }

  const created = await createCounselingMeetEvent({
    requestId: appt.id,
    scheduledAt: startIso,
    endsAt: endsAt === undefined ? appt.ends_at : endsAt,
  });

  const { data: stored, error: storeError } = await supabase
    .from("appointments")
    .update(persistPatch(created.meetingUrl, created.eventId))
    .eq("id", appt.id)
    .is("meeting_url", null)
    .select("meeting_url, meeting_provider, meeting_event_id")
    .maybeSingle();

  if (storeError) {
    await audit(supabase, caller.id, "appointment.meet_link_created", appt.id, "persist_failed");
    return jsonError("Couldn't save the Meet link — try again or paste one instead.", 502);
  }
  if (!stored) {
    const { data: winner } = await supabase
      .from("appointments")
      .select("meeting_url, meeting_provider, meeting_event_id")
      .eq("id", appt.id)
      .maybeSingle();
    const win = winner as { meeting_url: string | null; meeting_provider: string | null; meeting_event_id: string | null } | null;
    if (win?.meeting_url) {
      await audit(supabase, caller.id, "appointment.meet_link_created", appt.id, "reused");
      return NextResponse.json({
        meetingUrl: win.meeting_url,
        provider: win.meeting_provider === "google_meet" ? "google_meet" : "manual",
        created: false,
        eventId: win.meeting_event_id,
        persisted: true,
      });
    }
    return jsonError("Couldn't save the Meet link — try again or paste one instead.", 502);
  }

  await audit(supabase, caller.id, "appointment.meet_link_created", appt.id, "created");
  return NextResponse.json({
    meetingUrl: created.meetingUrl,
    provider: "google_meet",
    created: true,
    eventId: created.eventId,
    persisted: true,
  });
}

async function createForReferral(
  supabase: Awaited<ReturnType<typeof createClient>>,
  caller: Caller,
  referralId: string,
  scheduledAt: string | undefined,
  endsAt: string | null | undefined,
) {
  const { data: ref, error: refErr } = await supabase
    .from("referrals")
    .select("id, assigned_counselor_id, status")
    .eq("id", referralId)
    .maybeSingle();
  if (refErr || !ref) return jsonError("Referral not found.", 404);
  const referral = ref as { id: string; assigned_counselor_id: string | null; status: string };
  if (caller.role === "counselor" && referral.assigned_counselor_id !== caller.counselorId) {
    return jsonError("You can only create a Meet link for referrals assigned to you.", 403);
  }

  const { data: existing } = await supabase
    .from("appointments")
    .select(APPT_SELECT)
    .eq("source_referral_id", referralId)
    .in("status", ["pending", "assigned", "confirmed"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) {
    return createForAppointment(supabase, caller, (existing as ApptRow).id, scheduledAt, endsAt);
  }

  if (!scheduledAt) {
    return jsonError("Pick a session time before creating a Meet link.", 422);
  }
  if (new Date(scheduledAt).getTime() <= Date.now()) {
    return jsonError("Sessions must be scheduled in the future.", 422);
  }

  const created = await createCounselingMeetEvent({
    requestId: referralId,
    scheduledAt,
    endsAt: endsAt ?? null,
  });
  await audit(supabase, caller.id, "appointment.meet_link_created", referralId, "referral_preview");
  return NextResponse.json({
    meetingUrl: created.meetingUrl,
    provider: "google_meet",
    created: true,
    eventId: created.eventId,
    persisted: false,
  });
}

export async function PATCH(request: Request) {
  const parsed = appointmentMeetSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !parsed.data.appointmentId) {
    return jsonError(parsed.success ? "Unknown session." : (parsed.error.issues[0]?.message ?? "Invalid input."), 400);
  }
  if (!isGoogleMeetConfigured()) {
    return jsonError("Chekie isn't set up to update Meet links yet.", 503);
  }

  const loaded = await loadCaller();
  if (!loaded.caller) return jsonError(loaded.error ?? "Forbidden.", loaded.status);
  const caller = loaded.caller;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("appointments")
    .select(APPT_SELECT)
    .eq("id", parsed.data.appointmentId)
    .maybeSingle();
  if (error || !data) return jsonError("Session not found.", 404);
  const appt = data as ApptRow;
  if (!canAccessAppointment(caller, appt)) {
    return jsonError("You can only update a Meet link for your own sessions.", 403);
  }
  if (!meetingPatchAllowed(appt.status, appt.mode)) {
    return jsonError("That session can't have its Meet event rescheduled.", 422);
  }
  if (appt.meeting_provider !== "google_meet" || !appt.meeting_event_id) {
    return NextResponse.json({ meetingUrl: appt.meeting_url, provider: "manual", created: false });
  }
  if (!parsed.data.scheduledAt) {
    return jsonError("Pick a session time.", 422);
  }

  try {
    await patchCounselingMeetEvent({
      eventId: appt.meeting_event_id,
      scheduledAt: parsed.data.scheduledAt,
      endsAt: parsed.data.endsAt ?? appt.ends_at,
    });
    await audit(supabase, caller.id, "appointment.meet_link_created", appt.id, "patched");
    return NextResponse.json({
      meetingUrl: appt.meeting_url,
      provider: "google_meet",
      created: false,
      eventId: appt.meeting_event_id,
    });
  } catch (err) {
    await audit(supabase, caller.id, "appointment.meet_link_created", appt.id, "patch_failed");
    return asGoogleError(err);
  }
}

export async function DELETE(request: Request) {
  const parsed = appointmentMeetSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !parsed.data.appointmentId) {
    return jsonError(parsed.success ? "Unknown session." : (parsed.error.issues[0]?.message ?? "Invalid input."), 400);
  }

  const loaded = await loadCaller();
  if (!loaded.caller) return jsonError(loaded.error ?? "Forbidden.", loaded.status);
  const caller = loaded.caller;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("appointments")
    .select(APPT_SELECT)
    .eq("id", parsed.data.appointmentId)
    .maybeSingle();
  if (error || !data) return jsonError("Session not found.", 404);
  const appt = data as ApptRow;
  if (!canAccessAppointment(caller, appt)) {
    return jsonError("You can only remove a Meet link from your own sessions.", 403);
  }
  if (!meetingRemoveAllowed(appt.status)) {
    return jsonError("Completed sessions keep their Meet link for history.", 409);
  }

  if (appt.meeting_event_id && isGoogleMeetConfigured()) {
    try {
      await deleteCounselingMeetEvent(appt.meeting_event_id);
    } catch (err) {
      if (err instanceof GoogleMeetError && err.code !== "not_found") {
        await audit(supabase, caller.id, "appointment.meet_link_removed", appt.id, "google_failed");
        return asGoogleError(err);
      }
    }
  } else if (appt.meeting_event_id && !isGoogleMeetConfigured()) {
    // Still detach locally so the join button disappears; the office can
    // delete the leftover calendar event by hand.
  }

  const { error: clearError } = await supabase.from("appointments").update(CLEAR_PATCH).eq("id", appt.id);
  if (clearError) {
    return jsonError("Couldn't detach the Meet link.", 502);
  }
  await audit(supabase, caller.id, "appointment.meet_link_removed", appt.id, "removed");
  return NextResponse.json({ meetingUrl: null, provider: "manual", created: false });
}
