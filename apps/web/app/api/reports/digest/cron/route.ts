import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/reports/digest/cron — scheduled in-app head digest (see vercel.json).
 *
 * Bearer CRON_SECRET only; never a user session. Uses the service-role client
 * because there is no signed-in head at cron time. The RPC is head/service-role
 * gated and returns aggregates only — no student ids, aliases, or note text.
 */
export const maxDuration = 60;

const DAY_MS = 24 * 60 * 60 * 1000;

export async function GET(request: Request) {
  const secret = process.env["CRON_SECRET"];
  if (!secret) {
    return NextResponse.json(
      { error: "Scheduled digests aren't configured (CRON_SECRET missing)." },
      { status: 503 }
    );
  }
  const header = request.headers.get("authorization") ?? "";
  if (header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const admin = createAdminClient();
  const to = new Date();
  const from = new Date(to.getTime() - DAY_MS);

  const { data: payload, error: rpcError } = await admin.rpc("head_report_digest", {
    from_ts: from.toISOString(),
    to_ts: to.toISOString(),
  });
  if (rpcError) {
    return NextResponse.json({ error: "Couldn't build the digest." }, { status: 500 });
  }

  const { data: saved, error: insertError } = await admin
    .from("report_digests")
    .insert({
      period_start: from.toISOString(),
      period_end: to.toISOString(),
      payload: payload ?? {},
    })
    .select("id,created_at")
    .single();
  if (insertError) {
    return NextResponse.json({ error: "Couldn't store the digest." }, { status: 500 });
  }

  return NextResponse.json({ digest: saved });
}
