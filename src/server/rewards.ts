import "server-only";
import { z } from "zod";

export const RewardSchema = z
  .object({
    name: z.string().trim().min(2, "Enter a name").max(60),
    description: z.string().trim().max(200).default(""),
    points_cost: z.number().int().min(1, "At least 1 point").max(1_000_000),
    kind: z.enum(["free_item", "discount_amount", "discount_percent", "gift"]),
    menu_item_id: z.string().uuid().nullable().default(null),
    value: z.number().min(0).max(100000).nullable().default(null),
    min_order: z.number().min(0).max(100000).default(0),
    valid_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
    valid_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
    quantity_total: z.number().int().min(0).max(1_000_000).nullable().default(null),
    redemption_valid_days: z.number().int().min(1).max(365).default(30),
    is_active: z.boolean().default(true),
  })
  .superRefine((v, c) => {
    if (v.kind === "free_item" && !v.menu_item_id) c.addIssue({ code: "custom", path: ["menu_item_id"], message: "Choose the free item" });
    if (v.kind === "discount_amount" && !(v.value && v.value > 0)) c.addIssue({ code: "custom", path: ["value"], message: "Enter the discount amount" });
    if (v.kind === "discount_percent" && !(v.value && v.value > 0 && v.value <= 100)) c.addIssue({ code: "custom", path: ["value"], message: "Enter a percentage from 1 to 100" });
    if (v.valid_from && v.valid_to && v.valid_from > v.valid_to) c.addIssue({ code: "custom", path: ["valid_to"], message: "Must be after the start date" });
  });
export type RewardInput = z.infer<typeof RewardSchema>;
