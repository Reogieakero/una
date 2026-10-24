import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * RLS integration tests.
 *
 * These are deliberately NOT part of `pnpm test` (the package only defines
 * `test:rls`): they need a running Postgres/Auth stack with every migration
 * applied. CI starts a local Supabase (`supabase start` + `supabase db
 * reset`) and runs them; locally set:
 *
 *   TEST_SUPABASE_URL=http://127.0.0.1:54321
 *   TEST_SUPABASE_ANON_KEY=<local anon key>
 *   TEST_SUPABASE_SERVICE_ROLE_KEY=<local service-role key>
 *
 * The suite skips itself when those variables are absent so an accidental
 * `vitest` invocation never fails for lack of infrastructure.
 */

const SUPABASE_URL = process.env.TEST_SUPABASE_URL;
const ANON_KEY = process.env.TEST_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;
const configured = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY);

const PASSWORD = "RlsTest!2026";
const runId = randomUUID().slice(0, 8);

const futureIso = () =>
  new Date(Date.now() + 86_400_000 + Math.floor(Math.random() * 3_600_000)).toISOString();

const emailFor = (label: string) => `${label}-${runId}@rls.test`;

function findId(rows: any[] | null, key: string, value: string): string {
  const row = rows?.find((candidate) => candidate[key] === value);
  if (!row) throw new Error(`seed row not found for ${key}=${value}`);
  return row.id as string;
}

type SeededProfile = { id: string; email: string };

describe.skipIf(!configured)("RLS integration", () => {
  let admin: SupabaseClient;
  const clients: SupabaseClient[] = [];
  const createdUserIds: string[] = [];

  let studentA: SeededProfile;
  let studentB: SeededProfile;
  let counselorA: SeededProfile;
  let counselorB: SeededProfile;
  let head: SeededProfile;
  let faculty: SeededProfile;

  let studentRowA: string;
  let studentRowB: string;
  let counselorRowA: string;
  let counselorRowB: string;

  let appointmentA: string;
  let appointmentB: string;
  let pss10A: string;
  let pss10B: string;
  let noteA: string;
  let noteB: string;
  let auditRow: string;

  const anonymousAlias = `Blue Heron ${runId}`;
  const realName = `Alice Realname ${runId}`;

  let asStudentA: SupabaseClient;
  let asStudentB: SupabaseClient;
  let asCounselorA: SupabaseClient;
  let asCounselorB: SupabaseClient;
  let asHead: SupabaseClient;
  let asFaculty: SupabaseClient;

  async function createAccount(
    role: string,
    label: string,
    fullName: string,
  ): Promise<SeededProfile> {
    const email = emailFor(label);
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (error) throw error;
    if (!data.user) throw new Error(`createUser returned no user for ${email}`);
    createdUserIds.push(data.user.id);

    const { error: profileError } = await admin
      .from("profiles")
      .insert({ id: data.user.id, email, role, full_name: fullName });
    if (profileError) throw profileError;

    return { id: data.user.id, email };
  }

  async function signIn(email: string): Promise<SupabaseClient> {
    const client = createClient(SUPABASE_URL!, ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
    if (error) throw error;
    clients.push(client);
    return client;
  }

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    studentA = await createAccount("student", "student-a", realName);
    studentB = await createAccount("student", "student-b", `Bob Realname ${runId}`);
    counselorA = await createAccount("counselor", "counselor-a", `Counselor A ${runId}`);
    counselorB = await createAccount("counselor", "counselor-b", `Counselor B ${runId}`);
    head = await createAccount("guidance_head", "head", `Head ${runId}`);
    faculty = await createAccount("faculty", "faculty", `Faculty ${runId}`);

    const { data: studentRows, error: studentError } = await admin
      .from("students")
      .insert([
        {
          profile_id: studentA.id,
          student_no: `A-${runId}`,
          anonymous_alias: anonymousAlias,
          program: "BSIT",
          year_level: "3",
        },
        {
          profile_id: studentB.id,
          student_no: `B-${runId}`,
          anonymous_alias: `Owl ${runId}`,
          program: "BSED",
          year_level: "2",
        },
      ])
      .select("id, profile_id");
    if (studentError) throw studentError;
    studentRowA = findId(studentRows, "profile_id", studentA.id);
    studentRowB = findId(studentRows, "profile_id", studentB.id);

    const { data: counselorRows, error: counselorError } = await admin
      .from("counselors")
      .insert([
        { profile_id: counselorA.id, employee_no: `CA-${runId}` },
        { profile_id: counselorB.id, employee_no: `CB-${runId}` },
      ])
      .select("id, profile_id");
    if (counselorError) throw counselorError;
    counselorRowA = findId(counselorRows, "profile_id", counselorA.id);
    counselorRowB = findId(counselorRows, "profile_id", counselorB.id);

    const { data: appointmentRows, error: appointmentError } = await admin
      .from("appointments")
      .insert([
        {
          student_id: studentRowA,
          counselor_id: counselorRowA,
          scheduled_at: futureIso(),
          mode: "in_person",
          status: "confirmed",
          concern: "Session for student A",
        },
        {
          student_id: studentRowB,
          counselor_id: counselorRowB,
          scheduled_at: futureIso(),
          mode: "in_person",
          status: "confirmed",
          concern: "Session for student B",
        },
      ])
      .select("id, student_id");
    if (appointmentError) throw appointmentError;
    appointmentA = findId(appointmentRows, "student_id", studentRowA);
    appointmentB = findId(appointmentRows, "student_id", studentRowB);

    const { data: pssRows, error: pssError } = await admin
      .from("pss10_assessments")
      .insert([
        {
          student_id: studentRowA,
          answers: [1, 2, 3, 0, 1, 2, 3, 4, 1, 0],
          total_score: 16,
          band: "moderate",
        },
        {
          student_id: studentRowB,
          answers: [0, 0, 0, 4, 4, 0, 4, 4, 0, 0],
          total_score: 0,
          band: "low",
        },
      ])
      .select("id, student_id");
    if (pssError) throw pssError;
    pss10A = findId(pssRows, "student_id", studentRowA);
    pss10B = findId(pssRows, "student_id", studentRowB);

    const { data: noteRows, error: noteError } = await admin
      .from("session_notes")
      .insert([
        {
          appointment_id: appointmentA,
          counselor_id: counselorRowA,
          content: "Private note A",
        },
        {
          appointment_id: appointmentB,
          counselor_id: counselorRowB,
          content: "Private note B",
        },
      ])
      .select("id, counselor_id");
    if (noteError) throw noteError;
    noteA = findId(noteRows, "counselor_id", counselorRowA);
    noteB = findId(noteRows, "counselor_id", counselorRowB);

    const { data: auditRows, error: auditError } = await admin
      .from("audit_logs")
      .insert({
        actor_profile_id: head.id,
        action: "rls.test.seed",
        entity: "rls_test",
        metadata: { runId },
      })
      .select("id");
    if (auditError) throw auditError;
    auditRow = auditRows[0].id;

    [asStudentA, asStudentB, asCounselorA, asCounselorB, asHead, asFaculty] =
      await Promise.all([
        signIn(studentA.email),
        signIn(studentB.email),
        signIn(counselorA.email),
        signIn(counselorB.email),
        signIn(head.email),
        signIn(faculty.email),
      ]);
  });

  afterAll(async () => {
    if (!admin) return;
    // Best-effort cleanup: auth deletion cascades profiles/students/counselors,
    // which cascades appointments/notes. Audit rows survive by design (actor is
    // set null), so remove those explicitly.
    await admin.from("audit_logs").delete().eq("entity", "rls_test");
    await admin.from("audit_logs").delete().eq("entity", "rls_test_anonymous");
    for (const id of createdUserIds) {
      await admin.auth.admin.deleteUser(id);
    }
  });

  it("scopes appointments to the owning student", async () => {
    const { data, error } = await asStudentA
      .from("appointments")
      .select("id, student_id")
      .in("id", [appointmentA, appointmentB]);
    expect(error).toBeNull();
    expect(data).toEqual([{ id: appointmentA, student_id: studentRowA }]);

    const { data: counselorView, error: counselorError } = await asCounselorA
      .from("appointments")
      .select("id")
      .in("id", [appointmentA, appointmentB]);
    expect(counselorError).toBeNull();
    expect(counselorView).toEqual([{ id: appointmentA }]);
  });

  it("does not let a student read another student's PSS-10", async () => {
    const { data, error } = await asStudentA
      .from("pss10_assessments")
      .select("id, student_id")
      .in("id", [pss10A, pss10B]);
    expect(error).toBeNull();
    expect(data).toEqual([{ id: pss10A, student_id: studentRowA }]);

    // Counselors are allowed to read assessments for care delivery.
    const { data: counselorView, error: counselorError } = await asCounselorA
      .from("pss10_assessments")
      .select("id")
      .in("id", [pss10A, pss10B])
      .order("id");
    expect(counselorError).toBeNull();
    expect(counselorView?.map((r: any) => r.id).sort()).toEqual([pss10A, pss10B].sort());
  });

  it("does not let a student read another student's profile or student row", async () => {
    const { data: profiles, error } = await asStudentA
      .from("profiles")
      .select("id")
      .in("id", [studentA.id, studentB.id]);
    expect(error).toBeNull();
    expect(profiles).toEqual([{ id: studentA.id }]);

    const { data: students, error: studentsError } = await asStudentA
      .from("students")
      .select("id")
      .in("id", [studentRowA, studentRowB]);
    expect(studentsError).toBeNull();
    expect(students).toEqual([{ id: studentRowA }]);

    // 00069: routine staff no longer read the students table at all.
    const { data: facultyStudents, error: facultyError } = await asFaculty
      .from("students")
      .select("id")
      .in("id", [studentRowA, studentRowB]);
    expect(facultyError).toBeNull();
    expect(facultyStudents).toEqual([]);

    const { data: facultyProfiles, error: facultyProfileError } = await asFaculty
      .from("profiles")
      .select("id")
      .in("id", [studentA.id, studentB.id]);
    expect(facultyProfileError).toBeNull();
    expect(facultyProfiles).toEqual([]);
  });

  it("keeps routine staff out of student rows and identity profiles", async () => {
    // Counselors have a caseload relationship with student A, but that must
    // not grant ambient access to the students/profiles tables.
    const { data: counselorStudents, error: counselorStudentsError } = await asCounselorA
      .from("students")
      .select("id, student_no, profile_id")
      .in("id", [studentRowA, studentRowB]);
    expect(counselorStudentsError).toBeNull();
    expect(counselorStudents).toEqual([]);

    const { data: counselorProfiles, error: counselorProfilesError } = await asCounselorA
      .from("profiles")
      .select("id")
      .in("id", [studentA.id, studentB.id]);
    expect(counselorProfilesError).toBeNull();
    expect(counselorProfiles).toEqual([]);

    // Head oversight retains the broader read.
    const { data: headStudents, error: headStudentsError } = await asHead
      .from("students")
      .select("id")
      .in("id", [studentRowA, studentRowB]);
    expect(headStudentsError).toBeNull();
    expect(headStudents?.map((r: any) => r.id).sort()).toEqual(
      [studentRowA, studentRowB].sort(),
    );

    const { data: headProfiles, error: headProfilesError } = await asHead
      .from("profiles")
      .select("id")
      .in("id", [studentA.id, studentB.id]);
    expect(headProfilesError).toBeNull();
    expect(headProfiles?.map((r: any) => r.id).sort()).toEqual(
      [studentA.id, studentB.id].sort(),
    );
  });

  it("returns alias-only directory rows scoped to the counselor caseload", async () => {
    const { data, error } = await asCounselorA.rpc("list_student_directory");
    expect(error).toBeNull();
    const rows = (data ?? []) as { id: string; anonymous_alias: string | null }[];
    expect(rows.map((r) => r.id)).toEqual([studentRowA]);
    expect(rows[0]?.anonymous_alias).toBe(anonymousAlias);
    expect(Object.keys(rows[0] ?? {})).not.toContain("student_no");
    expect(Object.keys(rows[0] ?? {})).not.toContain("profile_id");

    const { data: headRows, error: headError } = await asHead.rpc("list_student_directory");
    expect(headError).toBeNull();
    expect(((headRows ?? []) as { id: string }[]).map((r) => r.id).sort()).toEqual(
      [studentRowA, studentRowB].sort(),
    );

    // Faculty has no directory access.
    const { data: facultyRows, error: facultyError } = await asFaculty.rpc("list_student_directory");
    expect(facultyError).toBeNull();
    expect(facultyRows).toEqual([]);
  });

  it("scopes the student record and timeline to the caller caseload", async () => {
    const { data: mine, error: mineError } = await asCounselorA.rpc("get_student_record", {
      p_student_id: studentRowA,
    });
    expect(mineError).toBeNull();
    const rows = (mine ?? []) as Record<string, unknown>[];
    expect(rows).toHaveLength(1);
    expect(rows[0]?.anonymous_alias).toBe(anonymousAlias);
    // 00070: record reads never expose direct identifiers.
    expect(Object.keys(rows[0] ?? {})).not.toContain("student_no");
    expect(Object.keys(rows[0] ?? {})).not.toContain("contact_no");
    expect(Object.keys(rows[0] ?? {})).not.toContain("profile_id");

    const { data: other, error: otherError } = await asCounselorA.rpc("get_student_record", {
      p_student_id: studentRowB,
    });
    expect(otherError).toBeNull();
    expect(other).toEqual([]);

    const { data: timeline, error: timelineError } = await asCounselorA.rpc("get_student_timeline", {
      p_student_id: studentRowA,
    });
    expect(timelineError).toBeNull();
    const events = (timeline ?? []) as { event_type: string; note_id: string | null }[];
    expect(events.some((e) => e.event_type === "session")).toBe(true);
    // Note text stays out of the bulk timeline — only its id is present.
    expect(events.some((e) => e.note_id === noteA)).toBe(true);

    const { data: otherTimeline, error: otherTimelineError } = await asCounselorA.rpc(
      "get_student_timeline",
      { p_student_id: studentRowB },
    );
    expect(otherTimelineError).toBeNull();
    expect(otherTimeline).toEqual([]);

    const { data: headRecord, error: headError } = await asHead.rpc("get_student_record", {
      p_student_id: studentRowB,
    });
    expect(headError).toBeNull();
    expect((headRecord ?? []) as unknown[]).toHaveLength(1);
  });

  it("gates analytical trends and quality to the guidance head", async () => {
    const counselorTrend = await asCounselorA.rpc("head_wellbeing_trends", {
      from_ts: null,
      to_ts: null,
    });
    expect(counselorTrend.error).toBeNull();
    expect(counselorTrend.data).toEqual([]);

    const headTrend = await asHead.rpc("head_wellbeing_trends", { from_ts: null, to_ts: null });
    expect(headTrend.error).toBeNull();
    expect(((headTrend.data ?? []) as unknown[]).length).toBeGreaterThan(0);

    const counselorQuality = await asCounselorA.rpc("head_data_quality");
    expect(counselorQuality.error).toBeNull();
    expect(counselorQuality.data).toEqual([]);

    const headQuality = await asHead.rpc("head_data_quality");
    expect(headQuality.error).toBeNull();
    expect(((headQuality.data ?? []) as unknown[]).length).toBe(1);

    // Digests are head-readable only.
    const counselorDigest = await asCounselorA.from("report_digests").select("id");
    expect(counselorDigest.error).toBeNull();
    expect(counselorDigest.data).toEqual([]);
  });

  it("resolves referral identity by exact student number only", async () => {
    const { data: exact, error: exactError } = await asFaculty.rpc("lookup_student_for_referral", {
      p_student_no: `A-${runId}`,
    });
    expect(exactError).toBeNull();
    expect((exact ?? []) as { id: string }[]).toHaveLength(1);
    expect(((exact ?? []) as { id: string }[])[0]?.id).toBe(studentRowA);

    // Prefix / wildcard / empty lookups must not enumerate.
    for (const probe of ["A-", `${runId}`, "", "   "]) {
      const { data, error } = await asFaculty.rpc("lookup_student_for_referral", {
        p_student_no: probe,
      });
      expect(error).toBeNull();
      expect(data).toEqual([]);
    }

    // Counselors cannot use the referral lookup at all.
    const { data: counselorLookup, error: counselorLookupError } = await asCounselorA.rpc(
      "lookup_student_for_referral",
      { p_student_no: `A-${runId}` },
    );
    expect(counselorLookupError).toBeNull();
    expect(counselorLookup).toEqual([]);
  });

  it("resolves aliases only for records the caller can already reach", async () => {
    const { data, error } = await asCounselorA.rpc("get_student_aliases", {
      ids: [studentRowA, studentRowB],
    });
    expect(error).toBeNull();
    const rows = (data ?? []) as { id: string; anonymous_alias: string | null }[];
    expect(rows.map((r) => r.id)).toEqual([studentRowA]);

    const { data: facultyData, error: facultyError } = await asFaculty.rpc("get_student_aliases", {
      ids: [studentRowA, studentRowB],
    });
    expect(facultyError).toBeNull();
    expect(facultyData).toEqual([]);
  });

  it("rejects a student writing an appointment or PSS-10 for someone else", async () => {
    const { error: appointmentError } = await asStudentA.from("appointments").insert({
      student_id: studentRowB,
      scheduled_at: futureIso(),
      mode: "in_person",
      concern: "Forged appointment for another student",
    });
    expect(appointmentError).not.toBeNull();
    expect(appointmentError?.code).toBe("42501");

    const { error: pssError } = await asStudentA.from("pss10_assessments").insert({
      student_id: studentRowB,
      answers: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      total_score: 0,
      band: "low",
    });
    expect(pssError).not.toBeNull();
    expect(pssError?.code).toBe("42501");

    // Linking a valid own assessment to ANOTHER student's appointment is
    // still a cross-student write (00068 tightened the insert policy).
    const { error: linkedError } = await asStudentA.from("pss10_assessments").insert({
      student_id: studentRowA,
      appointment_id: appointmentB,
      answers: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      total_score: 0,
      band: "low",
    });
    expect(linkedError).not.toBeNull();
    expect(linkedError?.code).toBe("42501");

    // Retakes for the student's own appointment are allowed (unique index
    // dropped by 00068) and the latest row wins for the completion gate.
    const { error: retakeError } = await asStudentA.from("pss10_assessments").insert([
      {
        student_id: studentRowA,
        appointment_id: appointmentA,
        answers: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        total_score: 10,
        band: "low",
      },
      {
        student_id: studentRowA,
        appointment_id: appointmentA,
        answers: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
        total_score: 20,
        band: "moderate",
      },
    ]);
    expect(retakeError).toBeNull();

    // Confirm nothing slipped past RLS.
    const { count } = await admin
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("student_id", studentRowB);
    expect(count).toBe(1);
  });

  it("keeps session notes owner-only, with head oversight", async () => {
    const { data: studentView, error: studentError } = await asStudentA
      .from("session_notes")
      .select("id")
      .in("id", [noteA, noteB]);
    expect(studentError).toBeNull();
    expect(studentView).toEqual([]);

    const { data: counselorAView, error: counselorAError } = await asCounselorA
      .from("session_notes")
      .select("id")
      .in("id", [noteA, noteB]);
    expect(counselorAError).toBeNull();
    expect(counselorAView).toEqual([{ id: noteA }]);

    const { data: counselorBView, error: counselorBError } = await asCounselorB
      .from("session_notes")
      .select("id")
      .in("id", [noteA, noteB]);
    expect(counselorBError).toBeNull();
    expect(counselorBView).toEqual([{ id: noteB }]);

    const { data: headView, error: headError } = await asHead
      .from("session_notes")
      .select("id")
      .in("id", [noteA, noteB]);
    expect(headError).toBeNull();
    expect(headView?.map((r: any) => r.id).sort()).toEqual([noteA, noteB].sort());
  });

  it("blocks a student from promoting their own role", async () => {
    const { error } = await asStudentA
      .from("profiles")
      .update({ role: "counselor" })
      .eq("id", studentA.id);
    expect(error).not.toBeNull();
    expect(error?.message ?? "").toMatch(/guidance head/i);

    const { data: stillStudent } = await admin
      .from("profiles")
      .select("role")
      .eq("id", studentA.id)
      .single();
    expect(stillStudent?.role).toBe("student");
  });

  it("exposes audit logs only to head/admin and keeps them append-only", async () => {
    const { data: headView, error: headError } = await asHead
      .from("audit_logs")
      .select("id, action")
      .eq("id", auditRow);
    expect(headError).toBeNull();
    expect(headView).toEqual([{ id: auditRow, action: "rls.test.seed" }]);

    const { data: counselorView, error: counselorError } = await asCounselorA
      .from("audit_logs")
      .select("id")
      .eq("id", auditRow);
    expect(counselorError).toBeNull();
    expect(counselorView).toEqual([]);

    const { data: studentView, error: studentError } = await asStudentA
      .from("audit_logs")
      .select("id")
      .eq("id", auditRow);
    expect(studentError).toBeNull();
    expect(studentView).toEqual([]);

    // No UPDATE/DELETE policies exist for any authenticated client, so these
    // statements cannot touch the row even when the caller is head.
    const { data: updated } = await asHead
      .from("audit_logs")
      .update({ action: "tampered" })
      .eq("id", auditRow)
      .select("id");
    expect(updated).toEqual([]);

    const { data: deleted } = await asHead
      .from("audit_logs")
      .delete()
      .eq("id", auditRow)
      .select("id");
    expect(deleted).toEqual([]);

    const { data: afterAttempts } = await admin
      .from("audit_logs")
      .select("action")
      .eq("id", auditRow)
      .single();
    expect(afterAttempts?.action).toBe("rls.test.seed");

    // Appends still work: services log actions as the authenticated user.
    const { error: appendError } = await asCounselorA.from("audit_logs").insert({
      actor_profile_id: counselorA.id,
      action: "rls.test.append",
      entity: "rls_test",
    });
    expect(appendError).toBeNull();

    const { data: appended } = await admin
      .from("audit_logs")
      .select("id")
      .eq("action", "rls.test.append")
      .eq("actor_profile_id", counselorA.id);
    expect(appended).toHaveLength(1);
  });

  it("does not leak identity or concern text into appointment notifications", async () => {
    const { data: inserted, error } = await asStudentA
      .from("appointments")
      .insert({
        student_id: studentRowA,
        counselor_id: counselorRowA,
        scheduled_at: futureIso(),
        mode: "in_person",
        concern: "Please keep this anonymous",
        is_anonymous: true,
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    expect(inserted).toBeTruthy();
    if (!inserted) throw new Error("appointment insert returned no row");

    // 00063 replaced the old alias+concern body with a generic, content-free
    // fan-out. The alert must still reach the counselor (and head), but must
    // never expose the alias, real name, email, student number, or concern.
    const { data: notifications, error: notifyError } = await asCounselorA
      .from("notifications")
      .select("id, title, body, ref_id")
      .eq("type", "appointment")
      .eq("ref_id", inserted.id);
    expect(notifyError).toBeNull();
    expect(notifications?.length).toBeGreaterThan(0);

    const serialized = JSON.stringify(notifications);
    expect(serialized).not.toContain(anonymousAlias);
    expect(serialized).not.toContain(realName);
    expect(serialized).not.toContain(studentA.email);
    expect(serialized).not.toContain(`A-${runId}`);
    expect(serialized).not.toContain("Please keep this anonymous");
    for (const notification of notifications ?? []) {
      expect(notification.title).toBe("New session request");
      expect(notification.body).toBeNull();
    }
  });
});
