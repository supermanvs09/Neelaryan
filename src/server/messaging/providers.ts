import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { ApiError } from "../http";

/**
 * Outbound messaging. Real providers only:
 *   SMS & WhatsApp — Twilio Programmable Messaging (REST API)
 *   Email          — Resend (REST API)
 * Nothing is "sent" unless a provider is configured. In development (NODE_ENV !== "production")
 * an unconfigured channel falls back to the server log so the flows can be exercised locally;
 * that fallback is impossible in production, where an unconfigured channel is an explicit error.
 *
 * Environment:
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN
 *   TWILIO_SMS_FROM (E.164 number) or TWILIO_MESSAGING_SERVICE_SID   — SMS
 *   TWILIO_WHATSAPP_FROM (E.164 WhatsApp-enabled sender)            — WhatsApp
 *   RESEND_API_KEY, EMAIL_FROM ("NEELARYAN Café <hello@your-domain>") — email
 *   DEFAULT_COUNTRY_CODE (default "+91") — prefixed to 10-digit mobile numbers
 */

export type Channel = "sms" | "whatsapp" | "email";

export interface SendResult {
  provider: string;
  id: string | null;
  /** "sent" = accepted by the provider; delivery is confirmed later by webhook (SMS / WhatsApp). */
  status: "sent";
}

const env = (k: string) => process.env[k]?.trim() || "";
const isProd = () => process.env.NODE_ENV === "production";

export function channelConfig() {
  const twilio = Boolean(env("TWILIO_ACCOUNT_SID") && env("TWILIO_AUTH_TOKEN"));
  return {
    sms: twilio && Boolean(env("TWILIO_SMS_FROM") || env("TWILIO_MESSAGING_SERVICE_SID")),
    whatsapp: twilio && Boolean(env("TWILIO_WHATSAPP_FROM")),
    email: Boolean(env("RESEND_API_KEY") && env("EMAIL_FROM")),
  };
}

/** What each channel will actually do right now — shown to staff so nothing is claimed that isn't true. */
export function channelStatus() {
  const c = channelConfig();
  const mode = (ok: boolean) => (ok ? "live" : isProd() ? "off" : "dev-log");
  return {
    sms: { mode: mode(c.sms), provider: c.sms ? "Twilio" : null },
    whatsapp: { mode: mode(c.whatsapp), provider: c.whatsapp ? "Twilio" : null },
    email: { mode: mode(c.email), provider: c.email ? "Resend" : null },
    cron: Boolean(env("CRON_SECRET")),
  } as const;
}

export function toE164(phone: string) {
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  const cc = env("DEFAULT_COUNTRY_CODE") || "+91";
  return `${cc}${digits.replace(/^0+/, "")}`;
}

export class NotConfiguredError extends ApiError {
  constructor(channel: Channel) {
    super(503, channel === "email" ? "Email isn't set up yet. Ask the café to configure an email provider." : `${channel === "sms" ? "SMS" : "WhatsApp"} isn't set up yet.`, "NOT_CONFIGURED");
  }
}

export async function sendMessage(channel: Channel, to: string, msg: { subject?: string; text: string; html?: string; statusCallback?: string | null }): Promise<SendResult> {
  const c = channelConfig();
  if (!c[channel]) {
    if (isProd()) throw new NotConfiguredError(channel);
    // development only — never reachable in production
    console.info(`[dev-log ${channel}] → ${to}${msg.subject ? ` · ${msg.subject}` : ""}\n${msg.text}`);
    return { provider: "dev-log", id: null, status: "sent" };
  }
  return channel === "email" ? sendResend(to, msg) : sendTwilio(channel, to, msg);
}

async function sendTwilio(channel: "sms" | "whatsapp", to: string, msg: { text: string; statusCallback?: string | null }): Promise<SendResult> {
  const sid = env("TWILIO_ACCOUNT_SID");
  const form = new URLSearchParams();
  const dest = toE164(to);
  form.set("To", channel === "whatsapp" ? `whatsapp:${dest}` : dest);
  form.set("Body", msg.text);
  if (channel === "whatsapp") form.set("From", `whatsapp:${toE164(env("TWILIO_WHATSAPP_FROM"))}`);
  else if (env("TWILIO_MESSAGING_SERVICE_SID")) form.set("MessagingServiceSid", env("TWILIO_MESSAGING_SERVICE_SID"));
  else form.set("From", env("TWILIO_SMS_FROM"));
  if (msg.statusCallback) form.set("StatusCallback", msg.statusCallback);
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
    method: "POST",
    headers: { authorization: `Basic ${Buffer.from(`${sid}:${env("TWILIO_AUTH_TOKEN")}`).toString("base64")}`, "content-type": "application/x-www-form-urlencoded" },
    body: form,
    signal: AbortSignal.timeout(15000),
  });
  const data = (await res.json().catch(() => ({}))) as { sid?: string; message?: string; code?: number };
  if (!res.ok) throw new ProviderError(`Twilio ${res.status}${data.code ? ` (${data.code})` : ""}: ${data.message ?? "request failed"}`);
  return { provider: "twilio", id: data.sid ?? null, status: "sent" };
}

async function sendResend(to: string, msg: { subject?: string; text: string; html?: string }): Promise<SendResult> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env("RESEND_API_KEY")}`, "content-type": "application/json" },
    body: JSON.stringify({ from: env("EMAIL_FROM"), to: [to], subject: msg.subject || "NEELARYAN Café", text: msg.text, html: msg.html }),
    signal: AbortSignal.timeout(15000),
  });
  const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
  if (!res.ok) throw new ProviderError(`Resend ${res.status}: ${data.message ?? data.name ?? "request failed"}`);
  return { provider: "resend", id: data.id ?? null, status: "sent" };
}

export class ProviderError extends Error {}

/** Twilio webhook signature: base64(HMAC-SHA1(authToken, url + sorted(key+value)…)). */
export function verifyTwilioSignature(url: string, params: Record<string, string>, signature: string | null) {
  const token = env("TWILIO_AUTH_TOKEN");
  if (!token || !signature) return false;
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
  const expected = createHmac("sha1", token).update(data).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
