import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Seeds a disposable local Supabase with exactly one account per role plus the
 * fixtures each role smoke test needs. Never point this at staging/production:
 * it creates users and clinical rows.
 *
 * The state file only contains test emails/ids and non-sensitive fixture text;
 * passwords come from E2E_TEST_PASSWORD or the local default below.
 */

export const STATE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  ".state/seed.json",
);

export type SeedState = {
  runId: string;
  password: string;
  users: {
    student: { profileId: string; studentRowId: string; email: string };
    counselor: { profileId: string; counselorRowId: string; email: string };
    head: { profileId: string; email: string };
    faculty: { profileId: string; facultyRowId: string; email: string };
  };
  studentAlias: string;
  appointmentConcern: string;
  waiverAppointmentConcern: string;
  completedConcern: string;
  referralReason: string;
  referralId: string;
  appointmentId: string;
  waiverAppointmentId: string;
};

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing ${name}. Start local Supabase (supabase start && supabase db reset) and export ` +
        `TEST_SUPABASE_URL / TEST_SUPABASE_ANON_KEY / TEST_SUPABASE_SERVICE_ROLE_KEY.`,
    );
  }
  return value;
}

async function createAccount(
  admin: SupabaseClient,
  role: string,
  email: string,
  password: string,
  fullName: string,
): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) throw error;
  if (!data.user) throw new Error(`createUser returned no user for ${email}`);

  const { error: profileError } = await admin.from("profiles").insert({
    id: data.user.id,
    email,
    role,
    full_name: fullName,
  });
  if (profileError) throw profileError;

  return data.user.id;
}

function iso(millisFromNow: number): string {
  return new Date(Date.now() + millisFromNow).toISOString();
}

/** Playwright invokes this once before the webServer/tests. */
export default async function globalSetup(): Promise<void> {
  const url = required("TEST_SUPABASE_URL");
  const serviceRoleKey = required("TEST_SUPABASE_SERVICE_ROLE_KEY");
  const password = process.env.E2E_TEST_PASSWORD ?? "E2eTest!2026";
  const runId = randomUUID().slice(0, 8);

  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const emailFor = (label: string) => `${label}-${runId}@e2e.test`;
  const studentEmail = emailFor("student");
  const counselorEmail = emailFor("counselor");
  const headEmail = emailFor("head");
  const facultyEmail = emailFor("faculty");

  const [studentId, counselorProfileId, headId, facultyProfileId] =
    await Promise.all([
      createAccount(admin, "student", studentEmail, password, `E2E Student ${runId}`),
      createAccount(admin, "counselor", counselorEmail, password, `E2E Counselor ${runId}`),
      createAccount(admin, "guidance_head", headEmail, password, `E2E Head ${runId}`),
      createAccount(admin, "faculty", facultyEmail, password, `E2E Faculty ${runId}`),
    ]);

  const studentAlias = `E2E Owl ${runId}`;
  const appointmentConcern = `E2E counseling concern ${runId}`;
  const waiverAppointmentConcern = `E2E check-in waiver session ${runId}`;
  const completedConcern = `E2E completed report session ${runId}`;
  const referralReason = `E2E referral concern ${runId}`;

  const { data: studentRow, error: studentError } = await admin
    .from("students")
    .insert({
      profile_id: studentId,
      student_no: `E2E-${runId}`,
      anonymous_alias: studentAlias,
      program: "BSIT",
      year_level: "3",
    })
    .select("id")
    .single();
  if (studentError) throw studentError;
  if (!studentRow) throw new Error("student row not returned");

  const { data: counselorRow, error: counselorError } = await admin
    .from("counselors")
    .insert({ profile_id: counselorProfileId, employee_no: `E2E-C-${runId}` })
    .select("id")
    .single();
  if (counselorError) throw counselorError;
  if (!counselorRow) throw new Error("counselor row not returned");

  // All-week availability so any confirm/reschedule dialog has a valid slot.
  const availability = Array.from({ length: 7 }, (_, weekday) => ({
    counselor_id: counselorRow.id,
    weekday,
    start_time: "00:00:00",
    end_time: "23:59:00",
    is_recurring: true,
  }));
  const { error: availabilityError } = await admin
    .from("counselor_availability")
    .insert(availability);
  if (availabilityError) throw availabilityError;

  const { data: facultyRow, error: facultyError } = await admin
    .from("faculty_members")
    .insert({ profile_id: facultyProfileId, employee_no: `E2E-F-${runId}` })
    .select("id")
    .single();
  if (facultyError) throw facultyError;
  if (!facultyRow) throw new Error("faculty row not returned");

  // The counselor spec completes this past confirmed session.
  const { data: appointment, error: appointmentError } = await admin
    .from("appointments")
    .insert({
      student_id: studentRow.id,
      counselor_id: counselorRow.id,
      scheduled_at: iso(-2 * 60 * 60 * 1000),
      ends_at: iso(-60 * 60 * 1000),
      mode: "in_person",
      status: "confirmed",
      concern: appointmentConcern,
      is_anonymous: true,
    })
    .select("id")
    .single();
  if (appointmentError) throw appointmentError;
  if (!appointment) throw new Error("appointment row not returned");

  // Same shape, but no linked check-in: the counselor spec exercises the
  // explicit waiver path instead of the normal completion path.
  const { data: waiverAppointment, error: waiverAppointmentError } = await admin
    .from("appointments")
    .insert({
      student_id: studentRow.id,
      counselor_id: counselorRow.id,
      scheduled_at: iso(-4 * 60 * 60 * 1000),
      ends_at: iso(-3 * 60 * 60 * 1000),
      mode: "in_person",
      status: "confirmed",
      concern: waiverAppointmentConcern,
      is_anonymous: true,
    })
    .select("id")
    .single();
  if (waiverAppointmentError) throw waiverAppointmentError;
  if (!waiverAppointment) throw new Error("waiver appointment row not returned");

  // A second, already-completed session keeps the head report populated even
  // when the counselor spec is skipped or retried.
  const { error: completedError } = await admin.from("appointments").insert({
    student_id: studentRow.id,
    counselor_id: counselorRow.id,
    scheduled_at: iso(-3 * 24 * 60 * 60 * 1000),
    ends_at: iso(-3 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
    mode: "online",
    status: "completed",
    concern: completedConcern,
    is_anonymous: true,
  });
  if (completedError) throw completedError;

  const { error: pssError } = await admin.from("pss10_assessments").insert({
    student_id: studentRow.id,
    appointment_id: appointment.id,
    answers: [3, 3, 3, 3, 3, 3, 3, 3, 3, 2],
    total_score: 29,
    band: "high",
    // Inside the 7-day pre-session window for the past seeded session.
    created_at: iso(-3 * 60 * 60 * 1000),
  });
  if (pssError) throw pssError;

  // Pending referral owned by the seeded faculty member; the head sees it in
  // the office board and the faculty sees it in "Sent referrals history".
  const { data: referral, error: referralError } = await admin
    .from("referrals")
    .insert({
      referring_faculty_id: facultyRow.id,
      student_id: studentRow.id,
      reason: referralReason,
      description: referralReason,
      reason_category: "behavioral",
      priority: "high",
      status: "pending",
      case_classification: ["Behavioral"],
      submitted_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (referralError) throw referralError;
  if (!referral) throw new Error("referral row not returned");

  const state: SeedState = {
    runId,
    password,
    users: {
      student: { profileId: studentId, studentRowId: studentRow.id, email: studentEmail },
      counselor: {
        profileId: counselorProfileId,
        counselorRowId: counselorRow.id,
        email: counselorEmail,
      },
      head: { profileId: headId, email: headEmail },
      faculty: {
        profileId: facultyProfileId,
        facultyRowId: facultyRow.id,
        email: facultyEmail,
      },
    },
    studentAlias,
    appointmentConcern,
    waiverAppointmentConcern,
    completedConcern,
    referralReason,
    referralId: referral.id,
    appointmentId: appointment.id,
    waiverAppointmentId: waiverAppointment.id,
  };

  mkdirSync(dirname(STATE_PATH), { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), "utf8");
}
