"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { ArrowLeft, BellRing, Check, ChefHat, Clock, Gift, QrCode, RotateCcw, ShoppingBag, Smartphone, Star, XCircle } from "lucide-react";
import { OtpSignIn } from "@/components/shop/OtpSignIn";
import { useCartSheet } from "@/components/shop/CartSheet";
import { reorder, type PastItem } from "@/components/shop/reorder";
import { ShopButton, Spinner, rupee, toast } from "@/components/shop/ui";
import { useShop, useShopHydrated } from "@/lib/shop/store";
import { useAccount } from "@/lib/shop/account";
import { useMenu } from "@/lib/shop/menu";
import { useI18n, type MessageKey } from "@/lib/shop/i18n";
import { subscribe, upiLink } from "@/lib/shop/push";
import { clsx } from "@/lib/clsx";

interface PublicOrder {
  id: string;
  number: number;
  type: "dine_in" | "takeaway";
  status: "new" | "accepted" | "preparing" | "ready" | "served" | "completed" | "cancelled" | "rejected";
  payment_status: string;
  payment_method: "cash" | "upi" | "counter";
  upi_claimed_at: string | null;
  scheduled_for: string | null;
  subtotal: number;
  discount: number;
  service_charge: number;
  tax: number;
  total: number;
  amount_paid: number;
  points_used: number;
  customer_name: string;
  created_at: string;
  cancel_reason: string | null;
  table_label: string | null;
  points_earned: number | null;
  linked: boolean;
  feedback: { rating: number; comment: string | null } | null;
  items: (PastItem & { name: string; variant_name: string; line_total: number; discount: number; offer_title: string | null })[];
}

const time = (v: string) => new Date(v).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" });

export default function OrderPage() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const { t } = useI18n();
  const { id } = useParams<{ id: string }>();
  const placed = useSearchParams().get("placed") === "1";
  const hydrated = useShopHydrated();
  const mine = useShop((s) => s.orders.find((o) => o.id === id));
  const signedIn = useAccount((s) => s.signedIn);
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/public/orders/${id}`, { headers: mine ? { "x-order-token": mine.token } : {}, cache: "no-store" });
      if (r.status === 404) return setMissing(true);
      if (r.ok) {
        setOrder((await r.json()).order);
        setMissing(false);
      }
    } catch {
      /* offline: keep showing the last known state */
    }
  }, [id, mine]);

  useEffect(() => {
    if (!hydrated || signedIn === null) return;
    load();
  }, [hydrated, signedIn, load]);
  const live = order && !["completed", "cancelled", "rejected"].includes(order.status);
  useEffect(() => {
    if (!live) return;
    const i = setInterval(load, 5000);
    const vis = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", vis);
    return () => {
      clearInterval(i);
      document.removeEventListener("visibilitychange", vis);
    };
  }, [live, load]);

  if (missing)
    return (
      <div className="mx-auto max-w-md py-24 text-center">
        <p className="text-[20px] font-bold">{t("trk.missing")}</p>
        <p className="mt-1 text-muted">{t("trk.missingHint")}</p>
        <Link href="/orders" className="mt-5 inline-flex min-h-[48px] items-center rounded-lg bg-primary px-6 font-semibold text-primary-fg">
          {t("ord.back")}
        </Link>
      </div>
    );
  if (!order)
    return (
      <div className="grid place-items-center py-24 text-muted">
        <Spinner />
      </div>
    );
  return <Tracking order={order} token={mine?.token ?? null} placed={placed} reload={load} />;
}

const STEPS: { key: string; label: MessageKey; icon: typeof Clock }[] = [
  { key: "new", label: "trk.step.sent", icon: Clock },
  { key: "accepted", label: "trk.step.confirmed", icon: Check },
  { key: "preparing", label: "trk.step.preparing", icon: ChefHat },
  { key: "ready", label: "trk.step.ready", icon: Check },
];
const RANK: Record<string, number> = { new: 0, accepted: 1, preparing: 2, ready: 3, served: 4, completed: 5 };

function headlineKey(o: PublicOrder): MessageKey {
  if (o.status === "ready") return o.type === "dine_in" ? "trk.h.readyTable" : "trk.h.readyTake";
  return `trk.h.${o.status}` as MessageKey;
}

function Tracking({ order, token, placed, reload }: { order: PublicOrder; token: string | null; placed: boolean; reload: () => void }) {
  const { t } = useI18n();
  const account = useAccount((s) => s.data);
  const menu = useMenu((s) => s.menu);
  const openCart = useCartSheet((s) => s.set);
  const [cancelling, setCancelling] = useState(false);
  const stopped = order.status === "cancelled" || order.status === "rejected";
  const rank = RANK[order.status] ?? 0;
  const done = order.status === "completed" || order.status === "served";
  const headers: Record<string, string> = token ? { "x-order-token": token, "content-type": "application/json" } : { "content-type": "application/json" };
  const held = !!order.scheduled_for && rank <= 1 && new Date(order.scheduled_for).getTime() - 15 * 60000 > Date.now();
  const savings = order.items.reduce((s, i) => s + Number(i.discount) * i.qty, 0);

  const cancel = async () => {
    if (!confirm(t("trk.cancelConfirm"))) return;
    setCancelling(true);
    try {
      const r = await fetch(`/api/public/orders/${order.id}/cancel`, { method: "POST", headers });
      toast(r.ok ? t("trk.cancelled") : t("trk.cancelFailed"), r.ok ? "ok" : "warn");
      reload();
    } finally {
      setCancelling(false);
    }
  };
  const again = () => {
    if (!menu) return;
    const r = reorder(menu, order.items);
    if (!r.added) return toast(t("again.none"), "warn");
    toast(r.skipped ? t("again.partial", { n: r.skipped }) : t("again.added"), r.skipped ? "warn" : "ok");
    openCart(true);
  };

  return (
    <div className="mx-auto max-w-[720px]">
      <Link href="/orders" className="inline-flex h-10 items-center gap-1.5 pr-3 text-[14px] font-semibold text-muted hover:text-fg">
        <ArrowLeft size={17} aria-hidden /> {t("ord.back")}
      </Link>
      <section className={clsx("mt-1 rounded-xl border p-5 md:p-7", stopped ? "border-danger/40 bg-danger-soft" : "border-line bg-surface")} aria-live="polite">
        <p className="text-[13px] font-semibold text-muted">
          {t("trk.order", { n: order.number })} · {order.type === "dine_in" ? t("ctx.table", { table: order.table_label ?? "" }) : t("ctx.takeaway")} · {time(order.created_at)}
        </p>
        <h1 className="mt-1 text-[24px] font-bold leading-tight md:text-[28px]">{held ? t("trk.h.scheduled", { time: time(order.scheduled_for!) }) : t(headlineKey(order))}</h1>
        {held && <p className="mt-1 text-[14px] text-muted">{t("trk.scheduledHint")}</p>}
        {stopped && order.cancel_reason && <p className="mt-1 text-[14.5px]">{order.cancel_reason}</p>}
        {!stopped && (
          <ol className="mt-5 grid grid-cols-4 gap-2" aria-label="Progress">
            {STEPS.map((s, i) => {
              const reached = rank >= i;
              const current = rank === i;
              const Icon = s.icon;
              return (
                <li key={s.key} className="text-center">
                  <span className={clsx("mx-auto grid h-10 w-10 place-items-center rounded-full border-2", reached ? "border-primary bg-primary text-primary-fg" : "border-line text-muted", current && !done && "ring-4 ring-primary/20")}>
                    <Icon size={18} aria-hidden />
                  </span>
                  <span className={clsx("mt-1.5 block text-[12.5px] font-semibold", reached ? "text-fg" : "text-muted")}>{t(s.label)}</span>
                </li>
              );
            })}
          </ol>
        )}
        {!stopped && ["new", "accepted", "preparing"].includes(order.status) && menu?.push_key && <NotifyButton order={order} token={token} publicKey={menu.push_key} />}
        {order.status === "new" && (
          <div className="mt-5 flex items-center justify-between gap-3 border-t border-line pt-4 text-[13.5px] text-muted">
            <span>{t("trk.cancelHint")}</span>
            <ShopButton variant="secondary" className="min-h-[40px] px-4 text-[14px]" loading={cancelling} onClick={cancel}>
              <XCircle size={16} /> {t("trk.cancel")}
            </ShopButton>
          </div>
        )}
      </section>

      {!stopped && order.payment_method === "upi" && order.payment_status !== "refunded" && menu?.payments.upi_id && <UpiPanel order={order} headers={headers} vpa={menu.payments.upi_id} payee={menu.payments.upi_payee_name} onClaimed={reload} />}

      {done && token && <Feedback order={order} headers={headers} onSaved={reload} />}

      {menu?.loyalty.enabled && !stopped && !order.linked && !account && <JoinCard order={order} token={token} placed={placed} onJoined={reload} points={Math.floor(((order.subtotal - order.discount) / 100) * menu.loyalty.points_per_100)} minOrder={menu.loyalty.min_order_amount} />}
      {account && order.linked && (
        <p className="mt-4 flex items-center gap-2 rounded-xl bg-accent-soft px-4 py-3 text-[14px] text-accent-text">
          <Gift size={17} aria-hidden />
          {order.points_earned ? t("join.earned", { points: order.points_earned }) : t("join.pending")}
        </p>
      )}

      <section className="mt-4 rounded-xl border border-line bg-surface">
        <h2 className="border-b border-line px-5 py-3.5 text-[16px] font-bold">{t("trk.items")}</h2>
        <ul className="divide-y divide-line px-5">
          {order.items.map((i, k) => (
            <li key={k} className="flex justify-between gap-3 py-2.5 text-[14px]">
              <span className="min-w-0">
                <span className="font-semibold">
                  {i.qty} × {i.name}
                  {i.variant_name && <span className="font-normal text-muted"> · {i.variant_name}</span>}
                </span>
                {i.modifiers.length > 0 && <span className="block text-[12.5px] text-muted">{i.modifiers.map((m) => m.name).join(" · ")}</span>}
                {i.offer_title && <span className="block text-[12.5px] font-semibold text-success">{i.offer_title}</span>}
                {i.notes && <span className="block text-[12.5px] italic text-muted">“{i.notes}”</span>}
              </span>
              <span className="num shrink-0">{rupee(Number(i.line_total))}</span>
            </li>
          ))}
        </ul>
        <dl className="space-y-1 border-t border-line px-5 py-3 text-[14px]">
          {savings > 0 && (
            <div className="flex justify-between text-success">
              <dt>{t("co.offerSavings")}</dt>
              <dd className="num">{rupee(savings)}</dd>
            </div>
          )}
          <div className="flex justify-between text-muted">
            <dt>{t("cart.itemsTotal")}</dt>
            <dd className="num">{rupee(Number(order.subtotal))}</dd>
          </div>
          {Number(order.discount) > 0 && (
            <div className="flex justify-between text-success">
              <dt>{t("co.discount")}</dt>
              <dd className="num">−{rupee(Number(order.discount))}</dd>
            </div>
          )}
          {Number(order.service_charge) > 0 && (
            <div className="flex justify-between text-muted">
              <dt>{t("cart.service")}</dt>
              <dd className="num">{rupee(Number(order.service_charge))}</dd>
            </div>
          )}
          <div className="flex justify-between text-muted">
            <dt>GST</dt>
            <dd className="num">{rupee(Number(order.tax))}</dd>
          </div>
          <div className="flex justify-between pt-1 text-[17px] font-bold">
            <dt>{t("cart.total")}</dt>
            <dd className="num">{rupee(Number(order.total))}</dd>
          </div>
          <p className="pt-1 text-[13px] text-muted">
            {order.payment_status === "paid" ? t("trk.paid") : order.payment_status === "refunded" ? t("trk.refunded") : order.payment_method === "upi" ? "" : t(order.type === "dine_in" ? "co.payNoteTable" : "co.payNoteTake")}
          </p>
        </dl>
      </section>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {done && order.items.some((i) => i.menu_item_id) && (
          <ShopButton onClick={again}>
            <RotateCcw size={17} /> {t("trk.again")}
          </ShopButton>
        )}
        <Link href="/menu" className="inline-flex min-h-[46px] items-center gap-2 rounded-lg border border-line px-5 font-semibold hover:border-line-strong">
          {order.type === "dine_in" ? <QrCode size={17} aria-hidden /> : <ShoppingBag size={17} aria-hidden />} {t("trk.another")}
        </Link>
      </div>
    </div>
  );
}

function NotifyButton({ order, token, publicKey }: { order: PublicOrder; token: string | null; publicKey: string }) {
  const { t, lang } = useI18n();
  const key = `nr-notify-${order.id}`;
  const [state, setState] = useState<"idle" | "on" | "busy" | "blocked" | "install">("idle");
  useEffect(() => {
    try {
      if (localStorage.getItem(key)) setState("on");
    } catch {
      /* ignore */
    }
  }, [key]);
  const on = async () => {
    setState("busy");
    const r = await subscribe(publicKey);
    if (!r.ok) return setState(r.reason === "install" ? "install" : r.reason === "denied" ? "blocked" : "idle");
    const res = await fetch(`/api/public/orders/${order.id}/push`, { method: "POST", headers: { "content-type": "application/json", ...(token ? { "x-order-token": token } : {}) }, body: JSON.stringify({ subscription: r.sub, lang }) });
    if (!res.ok) return setState("idle");
    try {
      localStorage.setItem(key, "1");
    } catch {
      /* ignore */
    }
    setState("on");
  };
  return (
    <div className="mt-5 border-t border-line pt-4">
      {state === "on" ? (
        <p className="flex items-center gap-2 text-[14px] font-semibold text-success">
          <BellRing size={17} aria-hidden /> {t("trk.notifyOn")}
        </p>
      ) : state === "blocked" ? (
        <p className="text-[13.5px] text-muted">{t("trk.notifyBlocked")}</p>
      ) : state === "install" ? (
        <p className="text-[13.5px] text-muted">{t("trk.notifyIos")}</p>
      ) : (
        <ShopButton variant="secondary" loading={state === "busy"} onClick={on}>
          <BellRing size={17} /> {t("trk.notify")}
        </ShopButton>
      )}
    </div>
  );
}

function UpiPanel({ order, headers, vpa, payee, onClaimed }: { order: PublicOrder; headers: Record<string, string>; vpa: string; payee: string; onClaimed: () => void }) {
  const { t } = useI18n();
  const due = Math.max(0, Number(order.total) - Number(order.amount_paid));
  const link = upiLink(vpa, payee, due, `${payee} #${order.number}`);
  const [qr, setQr] = useState<string | null>(null);
  const [ref, setRef] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    QRCode.toDataURL(link, { margin: 1, width: 360, errorCorrectionLevel: "M" }).then(setQr, () => setQr(null));
  }, [link]);
  if (order.payment_status === "paid")
    return (
      <p className="mt-4 flex items-center gap-2 rounded-xl bg-success-soft px-4 py-3 text-[14px] font-semibold text-success">
        <Check size={17} aria-hidden /> {t("upi.confirmed")}
      </p>
    );
  const claim = async () => {
    setBusy(true);
    try {
      const r = await fetch(`/api/public/orders/${order.id}/upi-claim`, { method: "POST", headers, body: JSON.stringify(ref.trim() ? { reference: ref.trim() } : {}) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return toast(j.error ?? "Couldn't send that.", "warn");
      onClaimed();
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="mt-4 rounded-xl border border-line bg-surface p-5">
      <h2 className="flex items-center gap-2 text-[17px] font-bold">
        <Smartphone size={18} aria-hidden /> {t("upi.title", { amount: rupee(due) })}
      </h2>
      {order.upi_claimed_at ? (
        <p className="mt-2 rounded-lg bg-primary-soft px-3 py-2 text-[14px]">{t("upi.claimed")}</p>
      ) : (
        <>
          <p className="mt-1 text-[14px] text-muted">{t("upi.scan")}</p>
          <div className="mt-4 grid items-center gap-4 sm:grid-cols-[180px_1fr]">
            <div className="mx-auto w-[180px] rounded-lg border border-line bg-[#fff] p-2">{qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr} alt={`UPI QR · ${rupee(due)}`} className="w-full" />
            ) : (
              <div className="aspect-square" />
            )}</div>
            <div className="space-y-3">
              <a href={link} className="flex min-h-[48px] items-center justify-center gap-2 rounded-lg bg-primary px-5 font-semibold text-primary-fg hover:bg-primary-hover">
                {t("upi.open")}
              </a>
              <p className="text-center text-[12.5px] text-muted">{t("upi.to", { payee, vpa })}</p>
              <label className="block">
                <span className="mb-1 block text-[13px] font-semibold">{t("upi.ref")}</span>
                <input value={ref} onChange={(e) => setRef(e.target.value.replace(/[^A-Za-z0-9 -]/g, "").slice(0, 40))} className="field-input h-11 w-full" inputMode="text" />
              </label>
              <ShopButton variant="secondary" className="w-full" loading={busy} onClick={claim}>
                <Check size={17} /> {t("upi.paid")}
              </ShopButton>
            </div>
          </div>
          <p className="mt-3 text-[12.5px] text-muted">{t("upi.cash")}</p>
        </>
      )}
    </section>
  );
}

function Feedback({ order, headers, onSaved }: { order: PublicOrder; headers: Record<string, string>; onSaved: () => void }) {
  const { t } = useI18n();
  const [rating, setRating] = useState(order.feedback?.rating ?? 0);
  const [comment, setComment] = useState(order.feedback?.comment ?? "");
  const [editing, setEditing] = useState(!order.feedback);
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try {
      const r = await fetch(`/api/public/orders/${order.id}/feedback`, { method: "POST", headers, body: JSON.stringify({ rating, comment: comment.trim() || undefined }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return toast(j.error ?? "Couldn't send that.", "warn");
      toast(t("fb.thanks"));
      setEditing(false);
      onSaved();
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="mt-4 rounded-xl border border-line bg-surface p-5">
      <h2 className="text-[17px] font-bold">{t("fb.title")}</h2>
      <div className="mt-2 flex gap-1" role="radiogroup" aria-label={t("fb.title")}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={t("fb.stars", { n })} disabled={!editing} onClick={() => setRating(n)} className="grid h-11 w-11 place-items-center rounded-lg hover:bg-surface-2 disabled:hover:bg-transparent">
            <Star size={26} className={n <= rating ? "fill-[#B58A45] text-[#B58A45]" : "text-line-strong"} aria-hidden />
          </button>
        ))}
      </div>
      {editing ? (
        rating > 0 && (
          <div className="mt-3 space-y-3">
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={300} rows={2} placeholder={t("fb.comment")} className="field-input w-full resize-none" />
            <ShopButton onClick={send} loading={busy}>
              {t("fb.send")}
            </ShopButton>
          </div>
        )
      ) : (
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-[14px] text-muted">{order.feedback?.comment || t("fb.thanks")}</p>
          <button type="button" className="text-[13.5px] font-semibold text-primary hover:underline" onClick={() => setEditing(true)}>
            {t("fb.edit")}
          </button>
        </div>
      )}
    </section>
  );
}

function JoinCard({ order, token, placed, onJoined, points, minOrder }: { order: PublicOrder; token: string | null; placed: boolean; onJoined: () => void; points: number; minOrder: number }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(placed);
  const [done, setDone] = useState<string | null>(null);
  if (done)
    return (
      <p className="mt-4 flex items-center gap-2 rounded-xl bg-success-soft px-4 py-3 text-[14px] font-semibold text-success">
        <Check size={17} aria-hidden /> {done}
      </p>
    );
  return (
    <section className="mt-4 rounded-xl border border-line bg-surface p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent-text">
          <Gift size={19} aria-hidden />
        </span>
        <div className="flex-1">
          <h2 className="text-[17px] font-bold">{points > 0 && Number(order.subtotal) >= minOrder ? t("join.earn", { points }) : t("join.earnAny")}</h2>
          <p className="mt-0.5 text-[14px] text-muted">{t("join.hint")}</p>
        </div>
      </div>
      {open ? (
        <div className="mt-4">
          <OtpSignIn
            initialName={order.customer_name}
            claim={token ? { order_id: order.id, access_token: token } : null}
            onDone={({ isNew, claimed }) => {
              setDone(isNew ? t("join.welcome") : claimed?.claimed ? t("join.linked") : t("join.linked"));
              onJoined();
            }}
            compact
          />
        </div>
      ) : (
        <div className="mt-4 flex gap-2">
          <ShopButton onClick={() => setOpen(true)}>{t("rw.join")}</ShopButton>
          <ShopButton variant="ghost" onClick={() => setOpen(true)}>
            {t("join.member")}
          </ShopButton>
        </div>
      )}
    </section>
  );
}
