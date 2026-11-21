import { z } from "zod";
import { api, body, requirePermission } from "@/server/http";
import { tx } from "@/server/db";
import { audit, diff } from "@/server/audit";
import { getSetting, setSetting } from "@/server/settings";

const Business = z.object({
  name: z.string().trim().min(2, "Enter the café's name").max(60),
  tagline: z.string().trim().max(120).default(""),
  address: z.string().trim().max(300).default(""),
  phone: z.string().trim().max(20).default(""),
  email: z.union([z.literal(""), z.string().trim().email("Enter a valid email")]).default(""),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^([0-9]{2}[A-Z0-9]{13})?$/, "GSTIN is 15 characters")
    .default(""),
  timezone: z.literal("Asia/Kolkata").default("Asia/Kolkata"),
});
const Tax = z.object({
  gst_percent: z.number().min(0).max(28),
  service_charge_percent: z.number().min(0).max(20),
});
const Ordering = z.object({
  accepting_orders: z.boolean(),
  takeaway_enabled: z.boolean(),
  closed_message: z.string().trim().min(3).max(200),
  preorders_enabled: z.boolean().default(true),
  show_wait_time: z.boolean().default(true),
});
const Payments = z
  .object({
    cash_enabled: z.boolean(),
    upi_enabled: z.boolean(),
    upi_id: z
      .string()
      .trim()
      .regex(/^([A-Za-z0-9._-]{2,64}@[A-Za-z][A-Za-z0-9]{1,63})?$/, "Enter a UPI ID like cafe@okaxis"),
    upi_payee_name: z.string().trim().min(1).max(50),
  })
  .refine((v) => !v.upi_enabled || v.upi_id, { message: "Enter your UPI ID to turn on UPI payments.", path: ["upi_id"] })
  .refine((v) => v.cash_enabled || v.upi_enabled, { message: "Keep at least one way to pay switched on.", path: ["cash_enabled"] });

const Schema = z.discriminatedUnion("section", [
  z.object({ section: z.literal("business"), value: Business }),
  z.object({ section: z.literal("tax"), value: Tax }),
  z.object({ section: z.literal("ordering"), value: Ordering }),
  z.object({ section: z.literal("payments"), value: Payments }),
]);

export const GET = api(
  async () => {
    const [business, tax, ordering, payments] = await Promise.all([getSetting("business"), getSetting("tax"), getSetting("ordering"), getSetting("payments")]);
    return { business, tax, ordering, payments };
  },
  { permission: ["settings.manage", "orders.manage"] },
);

const LABEL = { business: "business details", tax: "tax settings", ordering: "online ordering", payments: "payment options" } as const;

/**
 * Settings. "ordering" (pause / resume online orders) is allowed to anyone who manages orders,
 * so a manager can stop orders in a rush; business details and tax need settings permission.
 */
export const PUT = api(
  async (ctx) => {
    const v = await body(ctx.req, Schema);
    if (v.section !== "ordering") requirePermission(ctx, "settings.manage");
    await tx(async (t) => {
      const before = await getSetting(v.section, t);
      await setSetting(t, v.section, v.value as never);
      await audit(t, ctx, "update", "settings", v.section, `Updated ${LABEL[v.section]}`, diff(before as unknown as Record<string, unknown>, v.value));
    });
    return { ok: true };
  },
  { permission: ["settings.manage", "orders.manage"] },
);
