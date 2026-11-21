import "server-only";
import webpush from "web-push";
import { q } from "./db";

/**
 * Web push (works with the phone locked; on iPhone after "Add to Home Screen").
 * Needs VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT (your site URL or mailto:).
 * Without them push is off and the app hides the notification buttons.
 */

const env = (k: string) => process.env[k]?.trim() || "";
export const pushEnabled = () => Boolean(env("VAPID_PUBLIC_KEY") && env("VAPID_PRIVATE_KEY"));
export const pushPublicKey = () => (pushEnabled() ? env("VAPID_PUBLIC_KEY") : null);

let configured = false;
function configure() {
  if (configured || !pushEnabled()) return pushEnabled();
  webpush.setVapidDetails(env("VAPID_SUBJECT") || env("NEXT_PUBLIC_SITE_URL") || "mailto:owner@example.com", env("VAPID_PUBLIC_KEY"), env("VAPID_PRIVATE_KEY"));
  configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag?: string;
}

interface Sub {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  lang: string;
}

async function deliver(subs: Sub[], payload: (lang: string) => PushPayload) {
  if (!configure() || !subs.length) return { sent: 0 };
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload(s.lang)), { TTL: 3600, urgency: "high" });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        // the browser unsubscribed or the subscription expired
        if (code === 404 || code === 410) await q("delete from push_subscriptions where id = $1", [s.id]).catch(() => undefined);
        else console.error("push failed", code ?? e);
      }
    }),
  );
  return { sent };
}

/** Never let a notification failure affect the request that triggered it. */
export function notifyLater(fn: () => Promise<unknown>) {
  if (!pushEnabled()) return;
  fn().catch((e) => console.error("push", e));
}

const READY: Record<string, { title: string; dine: string; take: string }> = {
  en: { title: "Your order is ready", dine: "It's on its way to your table.", take: "Please collect it at the counter." },
  hi: { title: "आपका ऑर्डर तैयार है", dine: "यह आपकी टेबल पर आ रहा है।", take: "कृपया काउंटर से ले लें।" },
  te: { title: "మీ ఆర్డర్ సిద్ధంగా ఉంది", dine: "ఇది మీ టేబుల్‌కి వస్తోంది.", take: "దయచేసి కౌంటర్ వద్ద తీసుకోండి." },
};

/** Guest: "your order is ready". */
export async function pushOrderReady(orderId: string) {
  const { rows: o } = await q<{ number: number; type: string }>("select number, type from orders where id = $1", [orderId]);
  if (!o[0]) return;
  const { rows } = await q<Sub>("select id, endpoint, p256dh, auth, lang from push_subscriptions where order_id = $1", [orderId]);
  await deliver(rows, (lang) => {
    const t = READY[lang] ?? READY.en;
    return { title: `${t.title} · #${o[0].number}`, body: o[0].type === "dine_in" ? t.dine : t.take, url: `/orders/${orderId}`, tag: `order-${orderId}` };
  });
}

/** Staff devices whose account can see orders. */
export async function pushStaff(payload: PushPayload) {
  const { rows } = await q<Sub>(
    `select p.id, p.endpoint, p.p256dh, p.auth, p.lang from push_subscriptions p
       join users u on u.id = p.user_id and u.is_active join roles r on r.key = u.role_key
      where 'orders.view' = any(r.permissions) or 'kitchen.view' = any(r.permissions)`,
  );
  await deliver(rows, () => payload);
}
