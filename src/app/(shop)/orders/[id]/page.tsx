"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, Check, ChefHat, Clock, MapPin, RotateCcw, Sparkles, UtensilsCrossed } from "lucide-react";
import { flowFor, isActive, useOrders } from "@/store/orders";
import type { Order, OrderStatus } from "@/store/types";
import { useApp } from "@/store/app";
import { useUI } from "@/store/ui";
import { PREP_ESTIMATE } from "@/data/config";
import { MENU_BY_ID } from "@/data/menu";
import { builderLine, simpleLine } from "@/lib/cart";
import { rupees, timeOf } from "@/lib/format";
import { clsx } from "@/lib/clsx";
import { kdsOnline } from "@/components/shell/KitchenSimulator";

function stepLabel(s: OrderStatus, o: Order) {
  switch (s) {
    case "NEW":
      return "Order placed";
    case "ACCEPTED":
      return "Accepted by the kitchen";
    case "PREPARING":
      return "Being prepared";
    case "READY":
      return o.mode === "dine-in" ? "Ready to serve" : o.mode === "takeaway" ? "Ready for pickup" : "Packed & ready";
    case "SERVED":
      return o.mode === "dine-in" ? "Served at your table" : "Picked up";
    case "OUT_FOR_DELIVERY":
      return "Out for delivery";
    case "COMPLETED":
      return "Completed";
    default:
      return s;
  }
}

function stepNote(s: OrderStatus, o: Order) {
  if (s === "PREPARING") return "Our chefs are preparing your order with the freshest ingredients.";
  if (s === "READY" && o.mode === "takeaway") return "Show your order number at the counter.";
  if (s === "READY" && o.mode === "dine-in") return "Coming to your table now.";
  return null;
}

/** Restrained celebration: gold & navy flakes that fall once. */
function Confetti() {
  const reduced = useReducedMotion();
  const bits = useMemo(
    () =>
      Array.from({ length: 34 }, (_, i) => ({
        x: (i * 37) % 100,
        d: (i % 7) * 0.08,
        r: (i * 47) % 360,
        c: ["#c9a04a", "#e8d3a0", "#10264a", "#d9b86a", "#f6eedd"][i % 5],
        w: 6 + (i % 3) * 3,
      })),
    [],
  );
  if (reduced) return null;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {bits.map((b, i) => (
        <motion.span
          key={i}
          className="absolute top-0 block rounded-[2px]"
          style={{ left: `${b.x}%`, width: b.w, height: b.w * 0.45, background: b.c }}
          initial={{ y: -20, rotate: b.r, opacity: 1 }}
          animate={{ y: 420, rotate: b.r + 300, opacity: [1, 1, 0] }}
          transition={{ duration: 2.2, delay: 0.3 + b.d, ease: [0.2, 0.6, 0.4, 1] }}
        />
      ))}
    </div>
  );
}

function Confirmation({ order, onTrack }: { order: Order; onTrack: () => void }) {
  const reduced = useReducedMotion();
  return (
    <section className="relative overflow-hidden rounded-[32px] bg-gradient-to-b from-[#fff7e4] to-cream px-6 pb-8 pt-10 text-center shadow-card" aria-labelledby="ok-title">
      <Confetti />
      <div className="mx-auto w-fit [perspective:700px]">
        <motion.div
          className="grid h-28 w-28 place-items-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#fbe9b6,#d9b86a_45%,#a8812f)] shadow-gold"
          initial={reduced ? false : { rotateY: -180, scale: 0.4, opacity: 0 }}
          animate={{ rotateY: 0, scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 120, damping: 12 }}
        >
          <svg viewBox="0 0 52 52" className="h-14 w-14" aria-hidden>
            <motion.path d="M14 27 l8 8 l17 -18" fill="none" stroke="#0b1a33" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: reduced ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.45, duration: 0.5 }} />
          </svg>
        </motion.div>
      </div>
      <h1 id="ok-title" className="mt-5 font-display text-[40px] font-semibold leading-none text-navy-900">
        Order confirmed!
      </h1>
      <p className="mt-2 text-ink-soft">Your order has been placed successfully.</p>
      <div className="mx-auto mt-5 max-w-sm rounded-2xl bg-white/80 p-4 text-left">
        <p className="font-display text-[24px] font-semibold text-navy-900">Order #{order.id}</p>
        <p className="mt-1 flex items-center gap-2 text-[14.5px] text-ink-soft">
          {order.mode === "dine-in" ? <UtensilsCrossed size={16} /> : <MapPin size={16} />}
          {order.mode === "dine-in" ? `Table ${order.table} · Dine in` : order.mode === "takeaway" ? "Takeaway · pick up at the counter" : `Delivery · ${order.address}`}
        </p>
        <p className="mt-1 flex items-center gap-2 text-[14.5px] text-ink-soft">
          <Clock size={16} /> Estimated preparation <b className="text-navy-900">{PREP_ESTIMATE}</b>
        </p>
      </div>
      <div className="mx-auto mt-5 flex max-w-sm flex-col gap-2.5">
        <button onClick={onTrack} className="btn-primary h-12">
          View order tracking
        </button>
        <Link href="/menu" className="btn-ghost h-12">
          Continue browsing
        </Link>
      </div>
    </section>
  );
}

function Tracker({ order }: { order: Order }) {
  const flow = flowFor(order.mode);
  const idx = flow.indexOf(order.status);
  const at = (s: OrderStatus) => order.history.find((h) => h.status === s)?.at;
  const stopped = order.status === "REJECTED" || order.status === "CANCELLED";

  return (
    <section aria-labelledby="trk" className="rounded-[28px] border border-sand-400/60 bg-white/75 p-5 md:p-7">
      <h2 id="trk" className="font-display text-[28px] font-semibold text-navy-900">
        Live order tracking
      </h2>
      {stopped ? (
        <p className="mt-3 rounded-2xl bg-nonveg/10 px-4 py-3 text-[15px] font-medium text-nonveg">
          Sorry — this order was {order.status.toLowerCase()} by the café. {order.payment.status === "PAID" ? "A refund will be processed to your original payment method." : ""}
        </p>
      ) : (
        <ol className="mt-5" aria-live="polite">
          {flow.map((s, i) => {
            const done = i < idx || order.status === "COMPLETED";
            const current = i === idx && order.status !== "COMPLETED";
            const t = at(s);
            return (
              <li key={s} className="relative flex gap-4 pb-6 last:pb-0">
                {i < flow.length - 1 && <span aria-hidden className={clsx("absolute left-[15px] top-8 h-[calc(100%-24px)] w-0.5", done ? "bg-gold-500" : "bg-sand-400/70")} />}
                <span className="relative grid h-8 w-8 shrink-0 place-items-center">
                  {current && <span aria-hidden className="absolute inset-0 animate-pulse-ring rounded-full bg-gold-400" />}
                  <span className={clsx("relative grid h-8 w-8 place-items-center rounded-full border-2 transition-colors", done ? "border-gold-500 bg-gold-500 text-navy-900" : current ? "border-navy-800 bg-navy-800 text-ivory" : "border-sand-400 bg-white text-ink-muted")}>
                    {done ? <Check size={15} strokeWidth={3} /> : current && s === "PREPARING" ? <ChefHat size={15} /> : <span className="h-2 w-2 rounded-full bg-current" />}
                  </span>
                </span>
                <div className="pt-0.5">
                  <p className={clsx("font-semibold", done || current ? "text-navy-900" : "text-ink-muted")}>
                    {stepLabel(s, order)}
                    {current && <span className="sr-only"> (current step)</span>}
                  </p>
                  {t && <p className="text-[13px] text-ink-muted">{timeOf(t)}</p>}
                  {current && stepNote(s, order) && <p className="mt-0.5 text-[13.5px] text-ink-soft">{stepNote(s, order)}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function OrderView() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const hydrated = useOrders((s) => s.hydrated);
  const order = useOrders((s) => s.orders.find((o) => o.id === id));
  const [celebrate, setCelebrate] = useState(search.get("placed") === "1");
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    if (search.get("placed") === "1") router.replace(`/orders/${id}`, { scroll: false });
  }, [search, router, id]);
  useEffect(() => {
    const t = setInterval(() => setDemo(!kdsOnline()), 3000);
    setDemo(!kdsOnline());
    return () => clearInterval(t);
  }, []);

  if (!hydrated) return <div className="min-h-[60vh]" aria-busy="true" />;
  if (!order) {
    return (
      <div className="mx-auto max-w-md py-24 text-center">
        <p className="font-display text-[30px] font-semibold text-navy-900">We couldn&apos;t find that order</p>
        <p className="mt-1 text-ink-soft">Orders placed on this device appear under Orders.</p>
        <Link href="/orders" className="btn-primary mt-6">
          My orders
        </Link>
      </div>
    );
  }

  const ready = order.status === "READY";
  const reorder = () => {
    const s = useApp.getState();
    // re-price from today's menu so a reorder never uses stale prices
    for (const l of order.lines) {
      const item = MENU_BY_ID[l.itemId];
      if (!item || item.availability !== "available") continue;
      s.addLine(l.builder ? { ...builderLine(item, l.builder.kind, l.builder.selection, l.notes ?? "", l.qty) } : { ...simpleLine(item, l.simple ?? {}, l.notes ?? "", l.qty) });
    }
    useUI.getState().showToast("Added to your cart");
    useUI.getState().openCart();
  };

  return (
    <div className="mx-auto max-w-[1000px] space-y-5 pb-10">
      <div className="flex items-center gap-3">
        <Link href="/orders" className="grid h-11 w-11 place-items-center rounded-full border border-sand-400 bg-white/70 text-navy-800 hover:border-gold-500" aria-label="All orders">
          <ArrowLeft size={19} />
        </Link>
        <div>
          <p className="eyebrow">{timeOf(order.createdAt)}</p>
          <p className="font-display text-[30px] font-semibold leading-none text-navy-900">Order #{order.id}</p>
        </div>
      </div>

      <AnimatePresence>
        {celebrate && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}>
            <Confirmation order={order} onTrack={() => setCelebrate(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {ready && order.mode !== "delivery" && (
        <motion.section initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="rounded-[28px] bg-gradient-to-br from-navy-700 to-navy-950 p-6 text-center text-ivory shadow-lift" role="status">
          <Sparkles className="mx-auto text-gold-300" />
          <p className="mt-2 font-display text-[34px] font-semibold leading-none">Order ready!</p>
          <p className="mt-2 text-ivory/80">{order.mode === "dine-in" ? `Your order is on its way to Table ${order.table}.` : "Show this at the counter to collect."}</p>
          <p className="mx-auto mt-4 w-fit rounded-2xl bg-ivory px-6 py-3 font-display text-[36px] font-semibold tracking-wide text-navy-900">#{order.id}</p>
        </motion.section>
      )}

      <div className="grid gap-5 md:grid-cols-[1.2fr_1fr]">
        <Tracker order={order} />
        <section aria-labelledby="its" className="rounded-[28px] border border-sand-400/60 bg-white/75 p-5 md:p-7">
          <div className="flex items-center justify-between">
            <h2 id="its" className="font-display text-[24px] font-semibold text-navy-900">
              Items
            </h2>
            <span className={clsx("rounded-full px-3 py-1 text-[12px] font-bold", order.payment.status === "PAID" ? "bg-veg/10 text-veg" : "bg-gold-200 text-gold-700")}>
              {order.payment.status === "PAID" ? "Paid" : order.payment.method === "counter" ? "Pay at counter" : order.payment.status.replace("_", " ").toLowerCase()}
            </span>
          </div>
          <ul className="mt-3 space-y-2.5 text-[14.5px]">
            {order.lines.map((l) => (
              <li key={l.key} className="flex justify-between gap-3">
                <span className="min-w-0">
                  <b className="tabular-nums">{l.qty}×</b> {l.name}
                  {l.details.length > 0 && <span className="block text-[12.5px] text-ink-muted">{l.details.map((d) => `${d.label}: ${d.value}`).join(" · ")}</span>}
                  {l.notes && <span className="block text-[12.5px] italic text-ink-muted">“{l.notes}”</span>}
                </span>
                <span className="shrink-0 font-semibold tabular-nums">{rupees(l.unitPrice * l.qty)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-1 border-t border-sand-400/60 pt-3 text-[14px]">
            <div className="flex justify-between"><dt className="text-ink-soft">Subtotal</dt><dd>{rupees(order.subtotal)}</dd></div>
            {order.discount > 0 && <div className="flex justify-between text-veg"><dt>Discount {order.coupon ? `(${order.coupon})` : ""}</dt><dd>− {rupees(order.discount)}</dd></div>}
            <div className="flex justify-between"><dt className="text-ink-soft">Taxes</dt><dd>{rupees(order.tax)}</dd></div>
            <div className="flex justify-between pt-1 font-display text-[22px] font-semibold text-navy-900"><dt>Total</dt><dd>{rupees(order.total)}</dd></div>
          </dl>
          {!isActive(order) && (
            <button onClick={reorder} className="btn-ghost mt-4 w-full">
              <RotateCcw size={16} /> Reorder
            </button>
          )}
          {order.status === "COMPLETED" && order.payment.status === "PAID" && (
            <p className="mt-3 rounded-2xl bg-gold-200/50 px-4 py-2.5 text-[13.5px] text-navy-900">
              ✦ This order earns a NEELARYAN stamp (one per day). <Link href="/rewards" className="font-semibold underline">See rewards</Link>
            </p>
          )}
        </section>
      </div>

      {demo && isActive(order) && (
        <p className="text-center text-[12.5px] text-ink-muted">
          Demo: kitchen updates are simulated. Open the <Link href="/staff" className="font-semibold underline" target="_blank">Staff KDS</Link> in another tab to run the kitchen yourself.
        </p>
      )}
    </div>
  );
}

export default function OrderPage() {
  return (
    <Suspense>
      <OrderView />
    </Suspense>
  );
}
