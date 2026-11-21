import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runScheduledJobs } from "@/server/messaging/notify";
import { errorResponse } from "@/server/http";

/**
 * Scheduler entry point. Call every 5–15 minutes with `Authorization: Bearer <CRON_SECRET>`
 * (Vercel Cron sends this header automatically when CRON_SECRET is set).
 * Disabled entirely when CRON_SECRET isn't configured.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return NextResponse.json({ error: "Scheduler is not configured (CRON_SECRET)." }, { status: 503 });
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  if (given.length !== want.length || !timingSafeEqual(given, want)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await runScheduledJobs());
  } catch (e) {
    return errorResponse(e);
  }
}

export const POST = GET;
export const dynamic = "force-dynamic";
export const maxDuration = 60;
