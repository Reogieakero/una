import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runLogicalBackup } from "@/lib/backups/run-backup";

/**
 * /api/admin/backups — head-managed logical backups.
 * - GET: run history (newest first). Guidance head only.
 * - POST: run a backup now (exports → gzipped artifact → bucket → run row).
 *   Guidance head only. Long-running: raised maxDuration (plan-capped).
 */

export const maxDuration = 300;

async function requireHead() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, caller: null, error: NextResponse.json({ error: "Sign in required." }, { status: 401 }) };
  const { data: profile } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).single();
  const p = profile as { role?: string; is_active?: boolean | null } | null;
  if (p?.is_active === false) {
    return { supabase, caller: null, error: NextResponse.json({ error: "Account deactivated." }, { status: 403 }) };
  }
  if (p?.role !== "guidance_head") {
    return { supabase, caller: null, error: NextResponse.json({ error: "Guidance head only." }, { status: 403 }) };
  }
  return { supabase, caller: user, error: null as NextResponse | null };
}

export async function GET() {
  const { supabase, caller, error } = await requireHead();
  if (error || !caller) return error ?? NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { data, error: listError } = await supabase
    .from("backup_runs")
    .select("id,status,source,tables,row_counts,total_rows,bytes,checksum,storage_path,warnings,error,initiated_by,started_at,finished_at")
    .order("started_at", { ascending: false })
    .limit(100);
  if (listError) return NextResponse.json({ error: "Couldn't load backup history." }, { status: 500 });
  return NextResponse.json({ runs: data ?? [] });
}

export async function POST(request: Request) {
  const { caller, error } = await requireHead();
  if (error || !caller) return error ?? NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip");
  try {
    const run = await runLogicalBackup({ initiatedBy: caller.id, actorRole: "guidance_head", source: "manual", ip });
    return NextResponse.json({ run }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Backup failed." },
      { status: 500 }
    );
  }
}
