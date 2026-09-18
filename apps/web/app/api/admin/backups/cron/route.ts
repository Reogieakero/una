import { NextResponse } from "next/server";
import { runLogicalBackup } from "@/lib/backups/run-backup";

/**
 * GET /api/admin/backups/cron — scheduled daily backup (see vercel.json
 * crons). Bearer CRON_SECRET auth (Vercel Cron sends it when configured) —
 * never a user session, so this stays callable with no login. Missing or
 * wrong secret → 503/403 without touching the database.
 */

export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env["CRON_SECRET"];
  if (!secret) {
    return NextResponse.json(
      { error: "Scheduled backups aren't configured (CRON_SECRET missing)." },
      { status: 503 }
    );
  }
  const header = request.headers.get("authorization") ?? "";
  if (header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip");
  try {
    const run = await runLogicalBackup({ initiatedBy: null, actorRole: "system", source: "cron", ip });
    return NextResponse.json({ run });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Backup failed." },
      { status: 500 }
    );
  }
}
