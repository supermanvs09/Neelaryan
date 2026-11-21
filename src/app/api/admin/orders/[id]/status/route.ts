import { z } from "zod";
import { notifyLater, pushOrderReady } from "@/server/push";
import { api, body } from "@/server/http";
import { tx } from "@/server/db";
import { transition } from "@/server/orders";
import { audit } from "@/server/audit";

const Schema = z.object({
  to: z.enum(["accepted", "preparing", "ready", "served", "completed", "cancelled", "rejected"]),
  reason: z.string().trim().max(200).optional(),
});

/** Status change. The state machine decides what's allowed; kitchen staff can only move food forward. */
export const POST = api(
  async (ctx) => {
    const id = z.string().uuid().parse(ctx.params.id);
    const { to, reason } = await body(ctx.req, Schema);
    const o = await tx(async (t) => {
      const r = await transition(t, id, to, { userId: ctx.user!.id, permissions: ctx.user!.permissions, reason });
      if (to === "cancelled" || to === "rejected") await audit(t, ctx, to, "order", id, `${to === "cancelled" ? "Cancelled" : "Rejected"} order #${r.number}: ${reason}`);
      return r;
    });
    if (to === "ready") notifyLater(() => pushOrderReady(id));
    return { ok: true, status: o.status };
  },
  { permission: ["orders.manage", "kitchen.update"] },
);
