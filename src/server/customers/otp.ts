import "server-only";
import { randomInt, timingSafeEqual } from "node:crypto";
import { q, tx, type Queryable } from "../db";
import { bad, ApiError } from "../http";
import { rateLimit } from "../ratelimit";
import { newToken, sha256 } from "../auth/session";
import { sendMessage } from "../messaging/providers";
import { getSetting } from "../settings";

/**
 * One-time passcodes for customer sign-in.
 *  - 6 digits, stored only as a hash bound to the challenge id, valid 10 minutes
 *  - at most 5 guesses per code; at most 3 codes per number per 10 minutes and 10 per IP per hour
 *  - a code can be used once
 * Delivery uses the real SMS / email provider. In development without a provider the code is
 * written to the server log (see messaging/providers) — that path does not exist in production.
 */

const TTL_MIN = 10;
const MAX_ATTEMPTS = 5;

export const normalisePhone = (p: string) => p.replace(/\D/g, "").replace(/^(91|0)(?=[6-9]\d{9}$)/, "");
export const isPhone = (p: string) => /^[6-9]\d{9}$/.test(p);

const hashCode = (id: string, code: string) => sha256(`${id}:${code}`);

export function mask(dest: string, channel: "sms" | "email") {
  if (channel === "sms") return `+91 ••••• ${dest.slice(-5)}`;
  const [u, d] = dest.split("@");
  return `${u.slice(0, 2)}${"•".repeat(Math.max(1, u.length - 2))}@${d}`;
}

export async function requestOtp(input: { destination: string; channel: "sms" | "email"; ip: string | null }) {
  const dest = input.channel === "sms" ? normalisePhone(input.destination) : input.destination.trim().toLowerCase();
  if (input.channel === "sms" && !isPhone(dest)) throw bad("Enter a valid 10-digit mobile number.", { destination: "Enter a valid 10-digit mobile number" });
  if (input.channel === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dest)) throw bad("Enter a valid email address.", { destination: "Enter a valid email address" });

  await rateLimit(`otp:dest:${dest}`, 3, 600, "Too many codes requested for this number. Please wait 10 minutes.");
  if (input.ip) await rateLimit(`otp:ip:${input.ip}`, 10, 3600, "Too many codes requested. Please try again later.");

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const business = await getSetting("business");
  const existing = await q<{ id: string }>(input.channel === "sms" ? "select id from customers where phone = $1" : "select id from customers where lower(email) = $1", [dest]);
  const purpose = existing.rows[0] ? "login" : "register";

  const { rows } = await q<{ id: string }>(
    `insert into otp_challenges (channel, destination, purpose, code_hash, expires_at, provider, ip)
     values ($1,$2,$3,'pending', now() + make_interval(mins => $4), '', $5) returning id`,
    [input.channel, dest, purpose, TTL_MIN, input.ip],
  );
  const id = rows[0].id;
  await q("update otp_challenges set code_hash = $2 where id = $1", [id, hashCode(id, code)]);

  const text = `${code} is your ${business.name} verification code. It expires in ${TTL_MIN} minutes. Don't share it with anyone.`;
  try {
    const r = await sendMessage(input.channel, dest, { subject: `${code} is your ${business.name} code`, text });
    await q("update otp_challenges set provider = $2 where id = $1", [id, r.provider]);
    return { challenge_id: id, channel: input.channel, sent_to: mask(dest, input.channel), expires_in: TTL_MIN * 60, ...(r.provider === "dev-log" ? { dev_code: code } : {}) };
  } catch (e) {
    await q("update otp_challenges set consumed_at = now(), provider = 'failed' where id = $1", [id]);
    if (e instanceof ApiError) throw e;
    console.error("OTP delivery failed", e);
    throw new ApiError(502, "We couldn't send the code right now. Please try again in a minute.", "DELIVERY_FAILED");
  }
}

/**
 * Checks a code. Returns the verified destination; for a new customer also a one-time
 * sign-up token (valid 30 minutes) that the profile step must present.
 */
export async function verifyOtp(challengeId: string, code: string) {
  const r = await tx(async (t) => {
    const { rows } = await t.query<{ id: string; channel: "sms" | "email"; destination: string; code_hash: string; attempts: number; expired: boolean; consumed_at: string | null; verified_at: string | null }>(
      "select id, channel, destination, code_hash, attempts, expires_at <= now() as expired, consumed_at, verified_at from otp_challenges where id = $1 for update",
      [challengeId],
    );
    const c = rows[0];
    if (!c || c.consumed_at || c.verified_at) throw bad("This code has already been used or replaced. Request a new one.");
    if (c.expired) throw bad("This code has expired. Request a new one.");
    if (c.attempts >= MAX_ATTEMPTS) throw bad("Too many wrong attempts. Request a new code.");
    const a = Buffer.from(hashCode(c.id, code.trim()));
    const b = Buffer.from(c.code_hash);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      // recorded and committed before the error is raised (a throw here would roll it back)
      await t.query("update otp_challenges set attempts = attempts + 1 where id = $1", [c.id]);
      return { wrong: true as const, left: MAX_ATTEMPTS - c.attempts - 1 };
    }
    const { rows: cust } = await t.query<{ id: string; is_active: boolean }>(
      c.channel === "sms" ? "select id, is_active from customers where phone = $1" : "select id, is_active from customers where lower(email) = $1",
      [c.destination],
    );
    if (cust[0] && !cust[0].is_active) throw bad("This account is closed. Please speak to the café.");
    let signupToken: string | null = null;
    if (cust[0]) {
      await t.query(`update customers set ${c.channel === "sms" ? "phone_verified_at" : "email_verified_at"} = coalesce(${c.channel === "sms" ? "phone_verified_at" : "email_verified_at"}, now()) where id = $1`, [cust[0].id]);
      await t.query("update otp_challenges set consumed_at = now(), verified_at = now() where id = $1", [c.id]);
    } else {
      signupToken = newToken();
      await t.query("update otp_challenges set verified_at = now(), signup_token_hash = $2, expires_at = now() + interval '30 minutes' where id = $1", [c.id, sha256(signupToken)]);
    }
    // older pending codes for the same destination stop working
    await t.query("update otp_challenges set consumed_at = now() where destination = $1 and id <> $2 and consumed_at is null and verified_at is null", [c.destination, c.id]);
    return { wrong: false as const, channel: c.channel, destination: c.destination, customerId: cust[0]?.id ?? null, signupToken };
  });
  if (r.wrong) throw bad(r.left > 0 ? `That code isn't right. ${r.left} attempt${r.left === 1 ? "" : "s"} left.` : "Too many wrong attempts. Request a new code.", { code: "Incorrect code" });
  return r;
}

/** Redeems a sign-up token (once) and returns the verified destination. */
export async function consumeSignupToken(db: Queryable, token: string) {
  const { rows } = await db.query<{ id: string; channel: "sms" | "email"; destination: string }>(
    "select id, channel, destination from otp_challenges where signup_token_hash = $1 and consumed_at is null and expires_at > now() for update",
    [sha256(token)],
  );
  if (!rows[0]) throw bad("Your verification has expired. Please verify your number again.");
  await db.query("update otp_challenges set consumed_at = now() where id = $1", [rows[0].id]);
  return rows[0];
}
