import { z } from "zod";

/** A browser PushSubscription (toJSON()). Only https push services are accepted. */
export const PushSubscriptionSchema = z.object({
  endpoint: z
    .string()
    .url()
    .max(1000)
    .refine((u) => u.startsWith("https://"), "Invalid push endpoint"),
  keys: z.object({
    p256dh: z.string().regex(/^[A-Za-z0-9_-]{60,120}$/),
    auth: z.string().regex(/^[A-Za-z0-9_-]{16,40}$/),
  }),
});
