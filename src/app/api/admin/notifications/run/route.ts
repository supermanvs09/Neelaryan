import { api } from "@/server/http";
import { tx } from "@/server/db";
import { audit } from "@/server/audit";
import { runScheduledJobs } from "@/server/messaging/notify";

/** Runs the scheduled jobs now (due campaigns, birthdays, points expiry, send queue). */
export const POST = api(
  async (ctx) => {
    const r = await runScheduledJobs();
    await tx((t) => audit(t, ctx, "run", "jobs", null, "Ran scheduled jobs manually", r as Record<string, unknown>));
    return r;
  },
  { permission: "notifications.manage" },
);
