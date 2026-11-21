"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { ArrowLeft, Check, ChefHat, Clock, Gift, QrCode, ShoppingBag, XCircle } from "lucide-react";
import { OtpSignIn } from "@/components/shop/OtpSignIn";
import { ShopButton, Spinner, rupee, toast } from "@/components/shop/ui";
import { useShop, useShopHydrated } from "@/lib/shop/store";
import { useAccount } from "@/lib/shop/account";
import { useMenu } from "@/lib/shop/menu";
import { clsx } from "@/lib/clsx";

interface PublicOrder {
  id: string;
  number: number;
  type: "dine_in" | "takeaway";
  status: "new" | "accepted" | "preparing" | "ready" | "served" | "completed" | "cancelled" | "rejected";
  payment_status: string;
  subtotal: number;
  discount: number;
  service_charge: number;
  tax: number;
  total: number;
  amount_paid: number;
  points_used: number;
  customer_name: string;
  created_at: string;
  accepted_at: string | null;
  ready_at: string | null;
  completed_at: string | null;
  cancel_reason: string | null;
  table_label: string | null;
  points_earned: number | null;
  linked: boolean;
  items: { name: string; variant_name: string; modifiers: { name: string; group: string }[]; qty: number; line_total: number; notes: string }[];
}

const time = (v: string) => new Date(v).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });

export default function OrderPage() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}

function Inner() {
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
  // live updates while the order is moving
  const live = order && !["completed", "cancelled", "rejected"].includes(order.status);
  useEffect(() => {
    if (!live) return;
    const t = setInterval(load, 5000);
    const vis = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", vis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", vis);
    };
  }, [live, load]);

  if (missing)
    return (
      <div className="mx-auto max-w-md py-24 text-center">
        <p className="text-[20px] font-bold">We can&apos;t show this order</p>
        <p className="mt-1 text-muted">Orders can be viewed on the phone they were placed from, or after signing in.</p>
        <Link href="/orders" className="mt-5 inline-flex min-h-[48px] items-center rounded-lg bg-primary px-6 font-semibold text-primary-fg">
          Your orders
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

const STEPS = [
  { key: "new", label: "Order sent", icon: Clock },
  { key: "accepted", label: "Confirmed", icon: Check },
  { key: "preparing", label: "Being prepared", icon: ChefHat },
  { key: "ready", label: "Ready", icon: Check },
] as const;
const RANK: Record<string, number> = { new: 0, accepted: 1, preparing: 2, ready: 3, served: 4, completed: 5 };

function Tracking({ order, token, placed, reload }: { order: PublicOrder; token: string | null; placed: boolean; reload: () => void }) {
  const account = useAccount((s) => s.data);
  const loyalty = useMenu((s) => s.menu?.loyalty);
  const [cancelling, setCancelling] = useState(false);
  const stopped = order.status === "cancelled" || order.status === "rejected";
  const rank = RANK[order.status] ?? 0;
  const done = order.status === "completed" || order.status === "served";

  const headline = stopped
    ? order.status === "rejected"
      ? "Sorry — we couldn't take this order"
      : "This order was cancelled"
    : order.status === "new"
      ? "Order sent — waiting for the café to confirm"
      : order.status === "accepted"
        ? "Confirmed! It's in the queue"
        : order.status === "preparing"
          ? "Your food is being prepared"
          : order.status === "ready"
            ? order.type === "dine_in"
              ? "Ready — coming to your table"
              : "Ready! Collect it at the counter"
            : order.status === "served"
              ? "Served. Enjoy!"
              : "Completed. Thank you!";

  const cancel = async () => {
    if (!confirm("Cancel this order?")) return;
    setCancelling(true);
    try {
      const r = await fetch(`/api/public/orders/${order.id}/cancel`, { method: "POST", headers: token ? { "x-order-token": token } : {} });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) toast(j.error ?? "It's already being prepared — please ask our team.", "warn");
      else toast("Order cancelled");
      reload();
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="mx-auto max-w-[720px]">
      <Link href="/orders" className="inline-flex h-10 items-center gap-1.5 pr-3 text-[14px] font-semibold text-muted hover:text-fg">
        <ArrowLeft size={17} aria-hidden /> Your orders
      </Link>
      <section className={clsx("mt-1 rounded-xl border p-5 md:p-7", stopped ? "border-danger/40 bg-danger-soft" : "border-line bg-surface")} aria-live="polite">
        <p className="text-[13px] font-semibold text-muted">
          Order <span className="num">#{order.number}</span> · {order.type === "dine_in" ? `Table ${order.table_label}` : "Takeaway"} · {time(order.created_at)}
        </p>
        <h1 className="mt-1 text-[24px] font-bold leading-tight md:text-[28px]">{headline}</h1>
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
                  <span className={clsx("mt-1.5 block text-[12.5px] font-semibold", reached ? "text-fg" : "text-muted")}>{s.label}</span>
                </li>
              );
            })}
          </ol>
        )}
        {order.status === "new" && (
          <div className="mt-5 flex items-center justify-between gap-3 border-t border-line pt-4 text-[13.5px] text-muted">
            <span>Changed your mind? You can cancel until the café confirms.</span>
            <ShopButton variant="secondary" className="min-h-[40px] px-4 text-[14px]" loading={cancelling} onClick={cancel}>
              <XCircle size={16} /> Cancel
            </ShopButton>
          </div>
        )}
      </section>

      {/* loyalty invite: after ordering, for guests who aren't signed in */}
      {loyalty?.enabled && !stopped && !order.linked && !account && <JoinCard order={order} token={token} placed={placed} onJoined={reload} points={Math.floor(((order.subtotal - order.discount) / 100) * loyalty.points_per_100)} minOrder={loyalty.min_order_amount} />}
      {account && order.linked && (
        <p className="mt-4 flex items-center gap-2 rounded-xl bg-accent-soft px-4 py-3 text-[14px] text-accent-text">
          <Gift size={17} aria-hidden />
          {order.points_earned ? (
            <>
              You earned <b className="num">{order.points_earned}</b> points on this order.
            </>
          ) : order.status === "completed" ? (
            "This order didn't earn points."
          ) : (
            "Points are added to your account when this order is completed and paid."
          )}
        </p>
      )}

      <section className="mt-4 rounded-xl border border-line bg-surface">
        <h2 className="border-b border-line px-5 py-3.5 text-[16px] font-bold">What you ordered</h2>
        <ul className="divide-y divide-line px-5">
          {order.items.map((i, k) => (
            <li key={k} className="flex justify-between gap-3 py-2.5 text-[14px]">
              <span className="min-w-0">
                <span className="font-semibold">
                  {i.qty} × {i.name}
                  {i.variant_name && <span className="font-normal text-muted"> · {i.variant_name}</span>}
                </span>
                {i.modifiers.length > 0 && <span className="block text-[12.5px] text-muted">{i.modifiers.map((m) => m.name).join(" · ")}</span>}
                {i.notes && <span className="block text-[12.5px] italic text-muted">“{i.notes}”</span>}
              </span>
              <span className="num shrink-0">{rupee(Number(i.line_total))}</span>
            </li>
          ))}
        </ul>
        <dl className="space-y-1 border-t border-line px-5 py-3 text-[14px]">
          <div className="flex justify-between text-muted">
            <dt>Items</dt>
            <dd className="num">{rupee(Number(order.subtotal))}</dd>
          </div>
          {Number(order.discount) > 0 && (
            <div className="flex justify-between text-success">
              <dt>Discount{order.points_used ? ` (${order.points_used} points)` : ""}</dt>
              <dd className="num">−{rupee(Number(order.discount))}</dd>
            </div>
          )}
          {Number(order.service_charge) > 0 && (
            <div className="flex justify-between text-muted">
              <dt>Service charge</dt>
              <dd className="num">{rupee(Number(order.service_charge))}</dd>
            </div>
          )}
          <div className="flex justify-between text-muted">
            <dt>GST</dt>
            <dd className="num">{rupee(Number(order.tax))}</dd>
          </div>
          <div className="flex justify-between pt-1 text-[17px] font-bold">
            <dt>Total</dt>
            <dd className="num">{rupee(Number(order.total))}</dd>
          </div>
          <p className="pt-1 text-[13px] text-muted">
            {order.payment_status === "paid" ? "Paid — thank you." : order.payment_status === "refunded" ? "Refunded." : order.type === "dine_in" ? "Pay at your table or the counter." : "Pay at the counter when you collect."}
          </p>
        </dl>
      </section>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/menu" className="inline-flex min-h-[48px] items-center gap-2 rounded-lg border border-line px-6 font-semibold hover:border-line-strong">
          {order.type === "dine_in" ? <QrCode size={17} aria-hidden /> : <ShoppingBag size={17} aria-hidden />} Order something else
        </Link>
      </div>
    </div>
  );
}

function JoinCard({ order, token, placed, onJoined, points, minOrder }: { order: PublicOrder; token: string | null; placed: boolean; onJoined: () => void; points: number; minOrder: number }) {
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
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-text">
          <Gift size={19} aria-hidden />
        </span>
        <div className="flex-1">
          <h2 className="text-[17px] font-bold">{points > 0 && Number(order.subtotal) >= minOrder ? `Earn ${points} points on this order` : "Earn points on your orders"}</h2>
          <p className="mt-0.5 text-[14px] text-muted">Join our rewards with your mobile number — it takes a minute. Points add up to free drinks and treats.</p>
        </div>
      </div>
      {open ? (
        <div className="mt-4">
          <OtpSignIn
            initialPhone=""
            initialName={order.customer_name}
            claim={token ? { order_id: order.id, access_token: token } : null}
            onDone={({ isNew, claimed }) => {
              setDone(isNew ? "Welcome! This order is now on your rewards account." : claimed?.claimed ? "Signed in — this order is now on your account." : "Signed in.");
              onJoined();
            }}
            compact
          />
        </div>
      ) : (
        <div className="mt-4 flex gap-2">
          <ShopButton onClick={() => setOpen(true)}>Join rewards</ShopButton>
          <ShopButton variant="ghost" onClick={() => setOpen(true)}>
            I&apos;m a member
          </ShopButton>
        </div>
      )}
    </section>
  );
}
