import { beforeAll, describe, expect, it, vi } from "vitest";
import { freshDb, key } from "./helpers";
import type { Db } from "@/server/db";

let db: Db;
const staff = { userId: null, permissions: ["orders.manage", "kitchen.update", "billing.manage"] as never };

beforeAll(async () => {
  db = await freshDb();
  vi.spyOn(console, "info").mockImplementation(() => undefined); // dev-log provider output
});

describe("OTP sign-in", () => {
  it("verifies a code once, limits guesses, and signs up a new customer", async () => {
    const { requestOtp, verifyOtp, consumeSignupToken } = await import("@/server/customers/otp");
    const { createCustomer } = await import("@/server/customers/account");

    const r = await requestOtp({ destination: "98450 12345", channel: "sms", ip: "1.1.1.1" });
    expect(r.sent_to).toBe("+91 ••••• 12345");
    expect(r.dev_code).toMatch(/^\d{6}$/); // only because no SMS provider is configured outside production

    // the code is never stored in clear
    const row = (await db.query<{ code_hash: string; destination: string }>("select code_hash, destination from otp_challenges where id = $1", [r.challenge_id])).rows[0];
    expect(row.code_hash).not.toContain(r.dev_code!);
    expect(row.destination).toBe("9845012345");

    const wrong = r.dev_code === "000000" ? "111111" : "000000";
    await expect(verifyOtp(r.challenge_id, wrong)).rejects.toThrow(/4 attempts left/);

    const v = await verifyOtp(r.challenge_id, r.dev_code!);
    expect(v.customerId).toBeNull();
    expect(v.signupToken).toBeTruthy();
    await expect(verifyOtp(r.challenge_id, r.dev_code!)).rejects.toThrow(); // single use

    const id = await db.tx(async (t) => {
      const s = await consumeSignupToken(t, v.signupToken!);
      return createCustomer(t, { name: "Asha Rao", email: "", dob: "1994-11-21", marketing_consent: true, phone: s.destination, phoneVerified: true, source: "self", consentSource: "test" });
    });
    await expect(db.tx((t) => consumeSignupToken(t, v.signupToken!))).rejects.toThrow(/expired/); // token is one-time
    const c = (await db.query<{ phone: string; phone_verified_at: string | null; marketing_consent: boolean }>("select phone, phone_verified_at, marketing_consent from customers where id = $1", [id])).rows[0];
    expect(c.phone).toBe("9845012345");
    expect(c.phone_verified_at).not.toBeNull();

    // returning customer: the next code signs straight in
    const r2 = await requestOtp({ destination: "9845012345", channel: "sms", ip: "1.1.1.1" });
    const v2 = await verifyOtp(r2.challenge_id, r2.dev_code!);
    expect(v2.customerId).toBe(id);
  });

  it("locks a code after five wrong guesses and rate-limits requests", async () => {
    const { requestOtp, verifyOtp } = await import("@/server/customers/otp");
    const r = await requestOtp({ destination: "9000000001", channel: "sms", ip: "2.2.2.2" });
    const wrong = r.dev_code === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) await expect(verifyOtp(r.challenge_id, wrong)).rejects.toThrow();
    await expect(verifyOtp(r.challenge_id, r.dev_code!)).rejects.toThrow(/Too many wrong attempts/);
    await requestOtp({ destination: "9000000001", channel: "sms", ip: "2.2.2.2" });
    await requestOtp({ destination: "9000000001", channel: "sms", ip: "2.2.2.2" });
    await expect(requestOtp({ destination: "9000000001", channel: "sms", ip: "2.2.2.2" })).rejects.toThrow(/wait 10 minutes/);
  });
});

describe("claiming an order and campaigns", () => {
  it("links a completed order to the new account and earns its points once", async () => {
    const { createOrder, transition, recordPayment } = await import("@/server/orders");
    const { claimOrder } = await import("@/server/customers/account");
    const { sha256 } = await import("@/server/auth/session");
    const item = (await db.query<{ id: string }>("select id from menu_items where slug = 'cafe-latte'")).rows[0].id;
    const token = "t".repeat(40);
    const o = await db.tx((t) =>
      createOrder(t, { lines: [{ item_id: item, qty: 3 }], tier: "retail", customerId: null, type: "takeaway", channel: "web", tableId: null, customerName: "Asha", customerPhone: "9845012345", notes: "", idempotencyKey: key(), accessHash: sha256(token), createdBy: null, autoAccept: false }),
    );
    for (const s of ["accepted", "preparing", "ready"] as const) await db.tx((t) => transition(t, o.id, s, staff));
    await db.tx((t) => recordPayment(t, o.id, { method: "cash", amount: Number(o.total), reference: "" }, null as never));
    await db.tx((t) => transition(t, o.id, "completed", staff));

    const cust = (await db.query<{ id: string }>("select id from customers where phone = '9845012345'")).rows[0].id;
    await expect(db.tx((t) => claimOrder(t, o.id, "x".repeat(40), cust))).rejects.toThrow(/wasn't found/); // wrong device token
    const r = await db.tx((t) => claimOrder(t, o.id, token, cust));
    expect(r.claimed).toBe(true);
    const sub = (await db.query<{ subtotal: number }>("select subtotal from orders where id = $1", [o.id])).rows[0].subtotal;
    expect(r.points).toBe(Math.floor((Number(sub) / 100) * 5)); // 5 points per ₹100, proportional
    const again = await db.tx((t) => claimOrder(t, o.id, token, cust));
    expect(again.claimed).toBe(false);
    const bal = (await db.query<{ points_balance: number; visits: number }>("select points_balance, visits from customers where id = $1", [cust])).rows[0];
    expect(bal.visits).toBe(1);
  });

  it("sends campaigns only to opted-in customers, once each, with an unsubscribe link", async () => {
    const { enqueueCampaign, processQueue, audienceCount } = await import("@/server/messaging/notify");
    await db.query("insert into customers (name, phone, marketing_consent) values ('No Consent', '9111111111', false)");
    const tpl = (await db.query<{ id: string }>("insert into notification_templates (name, channel, kind, body) values ('Promo', 'sms', 'promotion', 'Hi {{first_name}}, you have {{points}} points at {{business}}.') returning id")).rows[0].id;
    expect((await audienceCount({ segment: "all" }, "sms")).n).toBe(1);
    const camp = (await db.query<{ id: string }>("insert into campaigns (name, template_id, audience) values ('Test', $1, '{\"segment\":\"all\"}') returning id", [tpl])).rows[0].id;
    expect((await enqueueCampaign(camp)).queued).toBe(1);
    expect((await enqueueCampaign(camp)).queued).toBe(0); // already sending — never twice
    const sent = await processQueue(10);
    // no provider configured: written to the log, never counted as sent
    expect(sent).toEqual({ sent: 0, failed: 0, logged: 1 });
    const n = (await db.query<{ body: string; destination: string; status: string; provider: string }>("select body, destination, status, provider from notifications where campaign_id = $1", [camp])).rows;
    expect(n).toHaveLength(1);
    expect(n[0].destination).toBe("9845012345");
    expect(n[0].body).toMatch(/^Hi Asha, you have \d+ points at NEELARYAN Café\.\nOpt out: .*\/unsubscribe\//);
    expect(n[0].provider).toBe("dev-log");
    expect(n[0].status).toBe("skipped");
    const c = (await db.query<{ status: string; stats: { sent: number; error: string } }>("select status, stats from campaigns where id = $1", [camp])).rows[0];
    expect(c.status).toBe("failed");
    expect(c.stats.sent).toBe(0);
    expect(c.stats.error).toMatch(/isn't set up/);
  });

  it("refuses to send in production when the channel isn't configured", async () => {
    const { sendMessage } = await import("@/server/messaging/providers");
    vi.stubEnv("NODE_ENV", "production");
    try {
      await expect(sendMessage("sms", "9845012345", { text: "hi" })).rejects.toThrow(/isn't set up/);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("greets birthdays once per year", async () => {
    const { birthdayJob } = await import("@/server/messaging/notify");
    const { setSetting } = await import("@/server/settings");
    const tpl = (await db.query<{ id: string }>("select id from notification_templates where kind = 'birthday' and channel = 'sms'")).rows[0].id;
    await db.tx((t) => setSetting(t, "notifications", { birthday_enabled: true, birthday_template_ids: [tpl], send_hour: 6 }));
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    await db.query("update customers set dob = $1 where phone = '9845012345'", [`1994-${today.slice(5)}`]);
    expect((await birthdayJob(true)).queued).toBe(1);
    expect((await birthdayJob(true)).queued).toBe(0);
  });
});
