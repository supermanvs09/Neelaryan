import "server-only";
import { z } from "zod";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$|^24:00$/, "Use a time like 14:30");
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null);

export const OfferSchema = z
  .object({
    title: z.string().trim().min(1, "Name the offer").max(40),
    percent_off: z.number().int().min(1, "At least 1%").max(90, "At most 90%"),
    menu_item_ids: z.array(z.string().uuid()).max(200).default([]),
    days: z.array(z.number().int().min(1).max(7)).max(7).default([]),
    starts_at: time.default("00:00"),
    ends_at: time.default("24:00"),
    valid_from: date,
    valid_to: date,
    is_active: z.boolean().default(true),
  })
  .refine((v) => v.ends_at > v.starts_at, { message: "The offer must end after it starts.", path: ["ends_at"] })
  .refine((v) => !v.valid_from || !v.valid_to || v.valid_to >= v.valid_from, { message: "The end date must be after the start date.", path: ["valid_to"] });
export type OfferInput = z.infer<typeof OfferSchema>;
