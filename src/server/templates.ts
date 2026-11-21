import "server-only";
import { z } from "zod";

export const TemplateSchema = z
  .object({
    name: z.string().trim().min(2, "Enter a name").max(60),
    channel: z.enum(["email", "sms", "whatsapp"]),
    kind: z.enum(["birthday", "promotion", "transactional", "custom"]),
    subject: z.string().trim().max(120).default(""),
    body: z.string().trim().min(5, "Write the message").max(2000),
    is_active: z.boolean().default(true),
  })
  .superRefine((v, c) => {
    if (v.channel === "email" && !v.subject) c.addIssue({ code: "custom", path: ["subject"], message: "Emails need a subject" });
    if (v.channel === "sms" && v.body.length > 480) c.addIssue({ code: "custom", path: ["body"], message: "Keep SMS under 480 characters (3 messages)" });
    const unknown = [...v.body.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/g)].map((m) => m[1]).filter((k) => !["first_name", "name", "points", "business", "unsubscribe_url"].includes(k));
    if (unknown.length) c.addIssue({ code: "custom", path: ["body"], message: `Unknown placeholder: {{${unknown[0]}}}` });
  });
