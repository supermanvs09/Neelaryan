"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Bell, BellOff, Bike, ChefHat, Clock, ShoppingBag, UtensilsCrossed, ArrowLeft, Info } from "lucide-react";
import { KDS_HEARTBEAT_KEY, nextStatus, useOrders } from "@/store/orders";
import type { Order, OrderMode, OrderStatus } from "@/store/types";
import { Wordmark } from "@/components/brand/Wordmark";
import { rupees, timeOf, dayKey } from "@/lib/format";
import { clsx } from "@/lib/clsx";

type Col = "new" | "prep" | "ready" | "handoff";
const COLS: { id: Col; title: string; statuses: OrderStatus[] }[] = [
  { id: "new", title: "New", statuses: ["NEW"] },
  { id: "prep", title: "Preparing", statuses: ["ACCEPTED", "PREPARING"] },
  { id: "ready", title: "Ready", statuses: ["READY"] },
  { id: "handoff", title: "Served / On the way", statuses: ["SERVED", "OUT_FOR_DELIVERY"] },
];

const ACTION: Partial<Record<OrderStatus, (o: Order) => string>> = {
  NEW: () => "Accept",
  ACCEPTED: () => "Start preparing",
  PREPARING: () => "Mark ready",
  READY: (o) => (o.mode === "dine-in" ? "Mark served" : o.mode === "takeaway" ? "Handed over" : "Out for delivery"),
  SERVED: (o) => (o.payment.status === "PAID" ? "Complete" : `Collect ${rupees(o.total)} & complete`),
  OUT_FOR_DELIVERY: () => "Delivered",
};

function chime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [880, 1320].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      o.type = "sine";
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.18);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + i * 0.18 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.18 + 0.5);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.18);
      o.stop(ctx.currentTime + i * 0.18 + 0.55);
    });
  } catch {
    /* audio not available */
  }
}

function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

const MODE_ICON: Record<OrderMode, typeof UtensilsCrossed> = { "dine-in": UtensilsCrossed, takeaway: ShoppingBag, delivery: Bike };

function Ticket({ o, now }: { o: Order; now: number }) {
  const setStatus = useOrders((s) => s.setStatus);
  const setPayment = useOrders((s) => s.setPayment);
  const mins = Math.floor((now - o.createdAt) / 60000);
  const secs = Math.floor(((now - o.createdAt) % 60000) / 1000);
  const late = mins >= 15 && o.status !== "READY";
  const Icon = MODE_ICON[o.mode];
  const label = ACTION[o.status]?.(o);

  const advance = () => {
    const n = nextStatus(o);
    if (!n) return;
    if (o.status === "SERVED" || o.status === "OUT_FOR_DELIVERY") {
      if (o.payment.status !== "PAID") setPayment(o.id, "PAID");
      setStatus(o.id, "COMPLETED");
      return;
    }
    setStatus(o.id, n);
  };

  return (
    <motion.article layout initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} className={clsx("rounded-2xl border bg-white p-4 shadow-card", o.status === "NEW" ? "border-gold-500" : "border-sand-400/70")}>
      <header className="flex items-start justify-between gap-2">
        <div>
          <p className="font-display text-[24px] font-semibold leading-none text-navy-900">#{o.id}</p>
          <p className="mt-1 flex items-center gap-1.5 text-[13px] font-semibold text-gold-700">
            <Icon size={14} />
            {o.mode === "dine-in" ? `Table ${o.table}` : o.mode === "takeaway" ? "Takeaway" : "Delivery"}
            <span className="text-ink-muted">· {timeOf(o.createdAt)}</span>
          </p>
        </div>
        <span className={clsx("flex items-center gap-1 rounded-full px-2.5 py-1 text-[12.5px] font-bold tabular-nums", late ? "bg-nonveg/10 text-nonveg" : "bg-cream text-navy-800")} aria-label={`${mins} minutes since order`}>
          <Clock size={13} /> {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
        </span>
      </header>
      <ul className="mt-3 space-y-2 border-t border-dashed border-sand-400 pt-3">
        {o.lines.map((l) => (
          <li key={l.key} className="text-[14.5px]">
            <b className="text-navy-900">{l.qty} ×</b> <span className="font-semibold text-navy-900">{l.name}</span>
            {l.details.length > 0 && <span className="block pl-6 text-[12.5px] leading-snug text-ink-soft">{l.details.map((d) => `${d.label}: ${d.value}`).join(" · ")}</span>}
            {l.notes && <span className="mt-0.5 block pl-6 text-[12.5px] font-semibold text-nonveg">Note: {l.notes}</span>}
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center justify-between text-[12.5px]">
        <span className="text-ink-muted">{o.customer.name}</span>
        <span className={clsx("rounded-full px-2 py-0.5 font-bold", o.payment.status === "PAID" ? "bg-veg/10 text-veg" : "bg-gold-200 text-gold-700")}>{o.payment.status === "PAID" ? "Paid" : "Payment due"}</span>
      </div>
      <div className="mt-3 flex gap-2">
        {o.status === "NEW" && (
          <button
            onClick={() => {
              if (window.confirm(`Reject order #${o.id}?`)) setStatus(o.id, "REJECTED");
            }}
            className="h-11 flex-1 rounded-xl border border-sand-400 text-[14px] font-semibold text-navy-800 hover:border-nonveg hover:text-nonveg"
          >
            Reject
          </button>
        )}
        {label && (
          <button onClick={advance} className={clsx("h-11 flex-[1.6] rounded-xl text-[14px] font-bold", o.status === "NEW" ? "bg-gradient-to-b from-gold-400 to-gold-500 text-navy-900" : "bg-navy-800 text-ivory hover:bg-navy-700")}>
            {label}
          </button>
        )}
      </div>
    </motion.article>
  );
}

export default function StaffPage() {
  const orders = useOrders((s) => s.orders);
  const hydrated = useOrders((s) => s.hydrated);
  const now = useNow();
  const [sound, setSound] = useState(true);
  const [filter, setFilter] = useState<OrderMode | "all">("all");
  const [col, setCol] = useState<Col>("new");
  const seen = useRef<Set<string> | null>(null);

  // tell customer tabs a real kitchen is driving orders (disables the demo simulator)
  useEffect(() => {
    const beat = () => {
      try {
        localStorage.setItem(KDS_HEARTBEAT_KEY, String(Date.now()));
      } catch {
        /* ignore */
      }
    };
    beat();
    const t = setInterval(beat, 3000);
    return () => {
      clearInterval(t);
      try {
        localStorage.removeItem(KDS_HEARTBEAT_KEY);
      } catch {
        /* ignore */
      }
    };
  }, []);

  // chime for orders that arrive while the screen is open
  useEffect(() => {
    if (!hydrated) return;
    const ids = new Set(orders.filter((o) => o.status === "NEW").map((o) => o.id));
    if (seen.current) {
      const fresh = [...ids].some((id) => !seen.current!.has(id));
      if (fresh && sound) chime();
    }
    seen.current = new Set([...(seen.current ?? []), ...ids]);
  }, [orders, hydrated, sound]);

  const today = dayKey(now);
  const visible = useMemo(() => orders.filter((o) => filter === "all" || o.mode === filter), [orders, filter]);
  const todays = orders.filter((o) => dayKey(o.createdAt) === today);
  const stats = [
    { label: "New", value: orders.filter((o) => o.status === "NEW").length },
    { label: "Preparing", value: orders.filter((o) => o.status === "ACCEPTED" || o.status === "PREPARING").length },
    { label: "Ready", value: orders.filter((o) => o.status === "READY").length },
    { label: "Completed today", value: todays.filter((o) => o.status === "COMPLETED").length },
  ];

  return (
    <div className="-mx-4 -mt-2 min-h-dvh bg-[#f4ecdb] md:-mx-8">
      <header className="sticky top-0 z-30 flex flex-wrap items-center gap-3 bg-navy-900 px-4 py-3 text-ivory md:px-8">
        <Link href="/" className="grid h-10 w-10 place-items-center rounded-full bg-ivory/10 hover:bg-ivory/20" aria-label="Back to customer app">
          <ArrowLeft size={18} />
        </Link>
        <span className="text-[30px]">
          <Wordmark tagline={false} tone="ivory" />
        </span>
        <span className="rounded-full bg-gold-400/20 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-gold-300">Kitchen</span>
        <span className="ml-auto flex items-center gap-2 text-[14px] tabular-nums text-ivory/80">
          <ChefHat size={16} /> {new Date(now).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
        </span>
        <button onClick={() => setSound((s) => !s)} aria-pressed={sound} className="flex h-10 items-center gap-2 rounded-full bg-ivory/10 px-3 text-[13px] font-semibold hover:bg-ivory/20">
          {sound ? <Bell size={16} /> : <BellOff size={16} />} Sound {sound ? "on" : "off"}
        </button>
      </header>

      <div className="px-4 py-4 md:px-8">
        <p className="mb-4 flex items-start gap-2 rounded-2xl bg-white/70 px-4 py-2.5 text-[13px] text-ink-soft">
          <Info size={16} className="mt-0.5 shrink-0 text-gold-700" />
          Demo kitchen display. Orders placed in the customer app (any tab on this device) appear here live. Staff sign-in, roles and multi-device sync arrive with the Supabase backend.
        </p>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-2xl bg-white p-4 shadow-card">
              <p className="font-display text-[34px] font-semibold leading-none text-navy-900">{s.value}</p>
              <p className="mt-1 text-[13px] font-semibold text-ink-muted">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto" role="group" aria-label="Order type filter">
          {(["all", "dine-in", "takeaway", "delivery"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f} className={clsx("chip capitalize", filter === f ? "border-navy-800 bg-navy-800 text-ivory" : "border-sand-400 bg-white text-navy-800")}>
              {f === "all" ? "All" : f.replace("-", " ")} ({f === "all" ? orders.filter((o) => !["COMPLETED", "REJECTED", "CANCELLED"].includes(o.status)).length : orders.filter((o) => o.mode === f && !["COMPLETED", "REJECTED", "CANCELLED"].includes(o.status)).length})
            </button>
          ))}
        </div>

        {/* phones: one column at a time */}
        <div className="mt-4 grid grid-cols-4 rounded-2xl bg-white/70 p-1 md:hidden" role="tablist">
          {COLS.map((c) => (
            <button key={c.id} role="tab" aria-selected={col === c.id} onClick={() => setCol(c.id)} className={clsx("h-10 rounded-xl text-[12.5px] font-bold", col === c.id ? "bg-navy-800 text-ivory" : "text-navy-800")}>
              {c.id === "handoff" ? "Served" : c.title} ({visible.filter((o) => c.statuses.includes(o.status)).length})
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {COLS.map((c) => {
            const list = visible.filter((o) => c.statuses.includes(o.status)).sort((a, b) => a.createdAt - b.createdAt);
            return (
              <section key={c.id} className={clsx("min-w-0", col !== c.id && "hidden md:block")} aria-labelledby={`col-${c.id}`}>
                <h2 id={`col-${c.id}`} className="mb-3 flex items-center gap-2 text-[15px] font-bold uppercase tracking-[0.12em] text-navy-800">
                  {c.title}
                  <span className="grid h-6 min-w-6 place-items-center rounded-full bg-navy-800 px-1.5 text-[12px] text-ivory">{list.length}</span>
                </h2>
                <div className="space-y-3">
                  <AnimatePresence initial={false}>
                    {list.map((o) => (
                      <Ticket key={o.id} o={o} now={now} />
                    ))}
                  </AnimatePresence>
                  {hydrated && list.length === 0 && <p className="rounded-2xl border border-dashed border-sand-600/40 px-4 py-8 text-center text-[13.5px] text-ink-muted">No orders here</p>}
                </div>
              </section>
            );
          })}
        </div>

        <section className="mt-8" aria-labelledby="done">
          <h2 id="done" className="mb-3 text-[15px] font-bold uppercase tracking-[0.12em] text-navy-800">
            History today
          </h2>
          <div className="overflow-x-auto rounded-2xl bg-white shadow-card">
            <table className="w-full min-w-[520px] text-left text-[14px]">
              <thead className="text-[12px] uppercase tracking-wider text-ink-muted">
                <tr>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {todays.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-ink-muted">
                      No orders yet today.
                    </td>
                  </tr>
                ) : (
                  todays.map((o) => (
                    <tr key={o.id} className="border-t border-sand-400/50">
                      <td className="px-4 py-2.5 font-semibold text-navy-900">
                        #{o.id} <span className="font-normal text-ink-muted">{timeOf(o.createdAt)}</span>
                      </td>
                      <td className="px-4 py-2.5">{o.mode === "dine-in" ? `Table ${o.table}` : o.mode}</td>
                      <td className="px-4 py-2.5 capitalize">{o.status.replaceAll("_", " ").toLowerCase()}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{rupees(o.total)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
