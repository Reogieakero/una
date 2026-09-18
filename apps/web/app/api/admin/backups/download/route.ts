import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { BACKUP_BUCKET } from "@/lib/backups/run-backup";
import { logEvent } from "@/lib/log-event";

/**
 * GET /api/admin/backups/download?id= — short-lived signed URL for a
 * finished backup artifact. Guidance head only. The access itself is
 * audit-logged (actor + IP): artifacts hold the office's most sensitive
 * rows, so every download is attributable.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id") ?? "";
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Valid backup id required." }, { status: 400 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).single();
  const p = profile as { role?: string; is_active?: boolean | null } | null;
  if (p?.is_active === false) return NextResponse.json({ error: "Account deactivated." }, { status: 403 });
  if (p?.role !== "guidance_head") return NextResponse.json({ error: "Guidance head only." }, { status: 403 });

  const admin = createAdminClient();
  const { data: run } = await admin
    .from("backup_runs")
    .select("id,status,storage_path")
    .eq("id", id)
    .maybeSingle();
  const row = run as { id: string; status: string; storage_path: string | null } | null;
  if (!row || !row.storage_path || !["completed", "partial"].includes(row.status)) {
    return NextResponse.json({ error: "Backup artifact not available." }, { status: 404 });
  }
  const { data: signed, error: signError } = await admin.storage
    .from(BACKUP_BUCKET)
    .createSignedUrl(row.storage_path, 1800);
  if (signError || !signed?.signedUrl) {
    return NextResponse.json({ error: "Couldn't prepare the download." }, { status: 500 });
  }
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip");
  try {
    await admin.from("audit_events").insert({
      actor_profile_id: user.id,
      actor_role: "guidance_head",
      action: "backup.download",
      entity: "backup_runs",
      entity_id: row.id,
      status_before: null,
      status_after: row.status,
      diff: {},
      source: "web",
      result: "success",
      ip: ip && /^[0-9a-fA-F.:]+$/.test(ip) ? ip : null,
    });
  } catch {
    logEvent("AUDIT_FAILED", { action: "backup.download", entityId: row.id, actorId: user.id });
  }
  return NextResponse.json({ url: signed.signedUrl });
}
