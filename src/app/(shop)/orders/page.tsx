"use client";

import Link from "next/link";
import { ChevronRight, ReceiptText } from "lucide-react";
import { isActive, useOrders } from "@/store/orders";
import type { Order, OrderStatus } from "@/store/types";
import { dateOf, rupees, timeOf } from "@/lib/format";
import { clsx } from "@/lib/clsx";

const LABEL: Record<OrderStatus, string> = {
  NEW: "Placed",
  ACCEPTED: "Accepted",
  PREPARING: "Preparing",
  READY: "Ready",
  SERVED: "Served",
  OUT_FOR_DELIVERY: "Out for delivery",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  REJECTED: "Rejected",
};

export default function OrdersPage() {
  const hydrated = useOrders((s) => s.hydrated);
  const orders = useOrders((s) => s.orders);
  const active = orders.filter(isActive);
  const past = orders.filter((o) => !isActive(o));

  return (
    <div className="mx-auto max-w-[860px] pb-10">
      <p className="eyebrow">Your NEELARYAN</p>
      <h1 className="mt-1 font-display text-[44px] font-semibold leading-none text-navy-900">Orders</h1>
      {!hydrated ? (
        <div className="mt-6 space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="skeleton h-24 rounded-3xl" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="py-20 text-center">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-cream text-gold-600">
            <ReceiptText size={32} />
          </div>
          <p className="mt-4 font-display text-[28px] font-semibold text-navy-900">No orders yet</p>
          <p className="mt-1 text-ink-soft">Your orders and live tracking will show up here.</p>
          <Link href="/menu" className="btn-primary mt-6">
            Start an order
          </Link>
        </div>
      ) : (
        <>
          {active.length > 0 && <List title="In progress" orders={active} live />}
          {past.length > 0 && <List title="Past orders" orders={past} />}
        </>
      )}
    </div>
  );
}

function List({ title, orders, live }: { title: string; orders: Order[]; live?: boolean }) {
  return (
    <section className="mt-7">
      <h2 className="mb-3 text-[15px] font-bold uppercase tracking-[0.14em] text-gold-700">{title}</h2>
      <ul className="space-y-3">
        {orders.map((o) => (
          <li key={o.id}>
            <Link href={`/orders/${o.id}`} className="card flex items-center gap-4 p-4 hover:shadow-lift">
              <span className={clsx("relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl", live ? "bg-navy-800 text-gold-300" : "bg-cream text-gold-700")}>
                {live && <span aria-hidden className="absolute inset-0 animate-pulse-ring rounded-2xl bg-gold-400/50" />}
                <ReceiptText size={20} className="relative" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <b className="text-navy-900">#{o.id}</b>
                  <span className={clsx("rounded-full px-2 py-0.5 text-[11.5px] font-bold", o.status === "COMPLETED" ? "bg-veg/10 text-veg" : o.status === "REJECTED" || o.status === "CANCELLED" ? "bg-nonveg/10 text-nonveg" : "bg-gold-200 text-gold-700")}>{LABEL[o.status]}</span>
                </span>
                <span className="block truncate text-[13.5px] text-ink-muted">
                  {o.lines.map((l) => `${l.qty}× ${l.name}`).join(", ")}
                </span>
                <span className="block text-[12.5px] text-ink-muted">
                  {dateOf(o.createdAt)} · {timeOf(o.createdAt)} · {o.mode === "dine-in" ? `Table ${o.table}` : o.mode === "takeaway" ? "Takeaway" : "Delivery"}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <b className="block tabular-nums text-navy-900">{rupees(o.total)}</b>
                <ChevronRight size={18} className="ml-auto mt-1 text-ink-muted" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
