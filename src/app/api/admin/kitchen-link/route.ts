import { randomBytes } from "node:crypto";
import { z } from "zod";
import { api, body } from "@/server/http";
import { tx } from "@/server/db";
import { audit } from "@/server/audit";
import { getSetting, setSetting } from "@/server/settings";
import { siteUrl } from "@/server/tables";

/** The secret-link kitchen screen: works without a login; reset it to lock out an old link. */
export const GET = api(
  async (ctx) => {
    const k = await getSetting("kitchen");
    return { enabled: k.link_enabled && !!k.link_token, url: k.link_enabled && k.link_token ? `${siteUrl(ctx.req.nextUrl.origin)}/kitchen/${k.link_token}` : null };
  },
  { permission: "settings.manage" },
);

const Schema = z.object({ action: z.enum(["enable", "reset", "disable"]) });

export const POST = api(
  async (ctx) => {
    const { action } = await body(ctx.req, Schema);
    return tx(async (t) => {
      const k = await getSetting("kitchen", t);
      const token = action === "disable" ? "" : action === "reset" || !k.link_token ? randomBytes(18).toString("base64url") : k.link_token;
      await setSetting(t, "kitchen", { link_enabled: action !== "disable", link_token: token });
      await audit(t, ctx, action, "kitchen_link", null, action === "disable" ? "Turned off the kitchen screen link" : action === "reset" ? "Made a new kitchen screen link (old one stops working)" : "Turned on the kitchen screen link");
      return { enabled: action !== "disable", url: token ? `${siteUrl(ctx.req.nextUrl.origin)}/kitchen/${token}` : null };
    });
  },
  { permission: "settings.manage" },
);
