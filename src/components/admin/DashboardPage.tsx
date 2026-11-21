"use client";

import { TableRequests } from "./orders/TableRequests";
import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Cake, ChefHat, Plus, ReceiptText } from "lucide-react";
import { Button, Card, ErrorBlock, LoadingBlock, PageHeader, Stat } from "./ui";
import { useAdminUser, useCan } from "./AdminShell";
import { useApi } from "@/lib/api-client";
import { ago, money, timeOf } from "@/lib/format";
import { formatQty } from "@/lib/units";
import { StatusBadge, PaymentBadge, type OrderStatus } from "./orders/shared";
import { clsx } from "@/lib/clsx";

interface Dash {
  at: string;
  live: { new: number; in_kitchen: number; ready: number; served: number; late: number; awaiting_payment: number; awaiting_payment_amount: number };
  tables: { total: number; occupied: number };
  today: { orders: number; revenue: number; gross: number; avg: number | null; yesterday_same_time: number; yesterday_same_time_orders: number; yesterday_total: number } | null;
  hourly: { hour: number; revenue: number; orders: number }[] | null;
  payments: { method: string; amount: number }[] | null;
  top_items: { name: string; qty: number; revenue: number }[];
  low_stock: { id: string; name: string; stock_qty: number; min_qty: number; display_unit: string }[] | null;
  customers: { new_today: number; birthdays_today: number; returning_today: number };
  supplier_due: number | null;
  recent: { id: string; number: number; type: string; status: OrderStatus; payment_status: string; total: number; created_at: string; customer_name: string; table_label: string | null }[];
}

function greeting() {
  const h = Number(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata", hour: "numeric", hour12: false }));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export function DashboardPage() {
  const { data, error, loading, reload } = useApi<Dash>("/api/admin/dashboard", { refreshMs: 30000 });
  const user = useAdminUser();
  const can = useCan();
  return (
    <>
      <PageHeader
        title={`${greeting()}, ${user.name.split(" ")[0]}`}
        description={data ? `Live · updated ${timeOf(data.at)}` : "Today at a glance"}
        actions={
          <>
            {can("kitchen.view") && (
              <Link href="/admin/kitchen">
                <Button variant="secondary" icon={<ChefHat size={16} />}>
                  Kitchen
                </Button>
              </Link>
            )}
            {can("orders.create") && (
              <Link href="/admin/orders/new">
                <Button icon={<Plus size={16} />}>New order</Button>
              </Link>
            )}
          </>
        }
      />
      <ErrorBlock error={error} retry={reload} />
      {loading || !data ? <LoadingBlock rows={8} /> : <Body d={data} />}
    </>
  );
}

function Delta({ now, before }: { now: number; before: number }) {
  if (!before) return null;
  const d = (now - before) / before;
  const up = d >= 0;
  return (
    <span className={clsx("inline-flex items-center gap-0.5 font-semibold", up ? "text-success" : "text-danger")}>
      {up ? <ArrowUpRight size={13} aria-hidden /> : <ArrowDownRight size={13} aria-hidden />}
      {Math.abs(Math.round(d * 100))}%
    </span>
  );
}

function Body({ d }: { d: Dash }) {
  const can = useCan();
  return (
    <div className="space-y-4">
      {can(["orders.view", "kitchen.view"]) && <TableRequests />}
      {/* Right now */}
      <section aria-label="Right now" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Stat label="New orders" value={d.live.new} tone={d.live.new ? "accent" : "default"} sub={d.live.new ? "Waiting to be accepted" : "All caught up"} href={can("orders.view") ? "/admin/orders" : undefined} />
        <Stat label="In the kitchen" value={d.live.in_kitchen} tone={d.live.late ? "warning" : "default"} sub={d.live.late ? `${d.live.late} waiting over 15 min` : "None running late"} href={can("kitchen.view") ? "/admin/kitchen" : undefined} />
        <Stat label="Ready to serve" value={d.live.ready} tone={d.live.ready ? "success" : "default"} />
        <Stat label="Awaiting payment" value={d.live.awaiting_payment} sub={d.live.awaiting_payment ? `${money(d.live.awaiting_payment_amount)} to collect` : undefined} />
        <Stat label="Tables in use" value={`${d.tables.occupied} / ${d.tables.total}`} href={can("tables.view") ? "/admin/tables" : undefined} />
      </section>

      {d.today && (
        <section aria-label="Sales today" className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Card
            title="Sales today"
            description="Completed orders, before GST"
            actions={
              can("finance.view") && (
                <Link href="/admin/finance" className="text-[13px] font-semibold text-primary hover:underline">
                  Finance →
                </Link>
              )
            }
          >
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-[12.5px] text-muted">Revenue</p>
                <p className="num text-[26px] font-bold leading-tight">{money(d.today.revenue)}</p>
                <p className="text-[12.5px] text-muted">
                  <Delta now={d.today.revenue} before={d.today.yesterday_same_time} /> {d.today.yesterday_same_time ? "vs this time yesterday" : `Yesterday: ${money(d.today.yesterday_total)}`}
                </p>
              </div>
              <div>
                <p className="text-[12.5px] text-muted">Orders</p>
                <p className="num text-[26px] font-bold leading-tight">{d.today.orders}</p>
                <p className="text-[12.5px] text-muted">
                  <Delta now={d.today.orders} before={d.today.yesterday_same_time_orders} /> {d.today.yesterday_same_time_orders ? "vs this time yesterday" : ""}
                </p>
              </div>
              <div>
                <p className="text-[12.5px] text-muted">Average bill</p>
                <p className="num text-[26px] font-bold leading-tight">{d.today.avg === null ? "—" : money(d.today.avg)}</p>
              </div>
            </div>
            {d.hourly && <HourBars hourly={d.hourly} />}
          </Card>
          <Card title="Collected today" description="Payments taken, incl. GST" padded={false}>
            {!d.payments?.length ? (
              <p className="p-4 text-[14px] text-muted">No payments yet today.</p>
            ) : (
              <ul className="divide-y divide-line text-[14px]">
                {d.payments.map((p) => (
                  <li key={p.method} className="flex justify-between px-4 py-2.5">
                    <span className="capitalize">{p.method === "upi" ? "UPI" : p.method}</span>
                    <span className="num font-semibold">{money(p.amount)}</span>
                  </li>
                ))}
                <li className="flex justify-between bg-surface-2/60 px-4 py-2.5 font-semibold">
                  <span>Total</span>
                  <span className="num">{money(d.payments.reduce((s, p) => s + p.amount, 0))}</span>
                </li>
              </ul>
            )}
            {d.supplier_due !== null && d.supplier_due > 0 && (
              <Link href="/admin/purchases" className="block border-t border-line px-4 py-2.5 text-[13px] text-muted hover:bg-surface-2">
                Owed to suppliers: <b className="num text-warning">{money(d.supplier_due)}</b>
              </Link>
            )}
          </Card>
        </section>
      )}

      <section className="grid gap-4 lg:grid-cols-3">
        <Card
          title="Latest orders"
          padded={false}
          className="lg:col-span-2"
          actions={
            can("orders.view") && (
              <Link href="/admin/orders" className="text-[13px] font-semibold text-primary hover:underline">
                All orders →
              </Link>
            )
          }
        >
          {!d.recent.length ? (
            <p className="p-6 text-center text-[14px] text-muted">
              <ReceiptText size={20} className="mx-auto mb-2" aria-hidden />
              No orders yet. They appear here as guests scan table QR codes or you take orders at the counter.
            </p>
          ) : (
            <ul className="divide-y divide-line text-[14px]">
              {d.recent.map((o) => (
                <li key={o.id}>
                  <Link href={can("orders.view") ? `/admin/orders?open=${o.id}` : "#"} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-surface-2/60">
                    <span className="min-w-0">
                      <b>#{o.number}</b>{" "}
                      <span className="text-muted">
                        · {o.type === "dine_in" ? `Table ${o.table_label ?? ""}` : "Takeaway"}
                        {o.customer_name && ` · ${o.customer_name}`} · {ago(o.created_at)}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <StatusBadge status={o.status} />
                      <span className="hidden sm:inline">
                        <PaymentBadge status={o.payment_status as never} />
                      </span>
                      <span className="num w-20 text-right font-semibold">{money(Number(o.total))}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <div className="space-y-4">
          <Card title="Selling today" padded={false}>
            {!d.top_items.length ? (
              <p className="p-4 text-[14px] text-muted">Nothing sold yet today.</p>
            ) : (
              <ol className="divide-y divide-line text-[14px]">
                {d.top_items.map((t, i) => (
                  <li key={t.name} className="flex items-center justify-between gap-2 px-4 py-2">
                    <span className="min-w-0 truncate">
                      <span className="num mr-2 text-muted">{i + 1}</span>
                      {t.name}
                    </span>
                    <span className="num shrink-0 font-semibold">× {t.qty}</span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
          {d.low_stock !== null && (
            <Card
              title="Running low"
              padded={false}
              actions={
                <Link href="/admin/inventory" className="text-[13px] font-semibold text-primary hover:underline">
                  Inventory →
                </Link>
              }
            >
              {!d.low_stock.length ? (
                <p className="p-4 text-[14px] text-muted">Everything is above its minimum level.</p>
              ) : (
                <ul className="divide-y divide-line text-[14px]">
                  {d.low_stock.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-2 px-4 py-2">
                      <span className="flex items-center gap-1.5">
                        <AlertTriangle size={14} className={Number(s.stock_qty) <= 0 ? "text-danger" : "text-warning"} aria-hidden />
                        {s.name}
                      </span>
                      <span className={clsx("num", Number(s.stock_qty) <= 0 ? "font-semibold text-danger" : "text-muted")}>{formatQty(Number(s.stock_qty), s.display_unit)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
          <Card title="Guests today">
            <dl className="grid grid-cols-3 gap-2 text-center">
              <div>
                <dt className="text-[12px] text-muted">Members ordered</dt>
                <dd className="num text-[20px] font-bold">{d.customers.returning_today}</dd>
              </div>
              <div>
                <dt className="text-[12px] text-muted">Joined</dt>
                <dd className="num text-[20px] font-bold">{d.customers.new_today}</dd>
              </div>
              <div>
                <dt className="text-[12px] text-muted">Birthdays</dt>
                <dd className="num text-[20px] font-bold">{d.customers.birthdays_today}</dd>
              </div>
            </dl>
            {d.customers.birthdays_today > 0 && can("customers.view") && (
              <Link href="/admin/customers" className="mt-3 flex items-center justify-center gap-1.5 text-[13px] font-semibold text-primary hover:underline">
                <Cake size={14} aria-hidden /> See who&apos;s celebrating
              </Link>
            )}
          </Card>
        </div>
      </section>
    </div>
  );
}

function HourBars({ hourly }: { hourly: { hour: number; revenue: number; orders: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (!hourly.length) return <p className="mt-4 text-[13px] text-muted">The hourly chart fills in as orders are completed.</p>;
  const lo = Math.min(8, ...hourly.map((h) => h.hour));
  const hi = Math.max(lo + 8, ...hourly.map((h) => h.hour));
  const hours = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
  const max = Math.max(...hourly.map((h) => h.revenue), 1);
  const at = new Map(hourly.map((h) => [h.hour, h]));
  const label = (h: number) => `${h % 12 || 12}${h < 12 ? "am" : "pm"}`;
  const hv = hover !== null ? at.get(hover) : null;
  return (
    <div className="mt-5">
      <p className="mb-2 flex items-center justify-between text-[12.5px] text-muted">
        <span>Revenue by hour</span>
        <span aria-live="polite">{hover !== null ? `${label(hover)}: ${hv ? `${money(hv.revenue)} · ${hv.orders} orders` : "no sales"}` : ""}</span>
      </p>
      <div className="flex h-24 items-end gap-[2px]" onMouseLeave={() => setHover(null)} role="img" aria-label="Revenue by hour today">
        {hours.map((h) => {
          const v = at.get(h)?.revenue ?? 0;
          return (
            <div key={h} className={clsx("flex h-full flex-1 items-end", hover === h && "bg-surface-2")} onMouseEnter={() => setHover(h)}>
              <div className="w-full rounded-t-[4px]" style={{ height: `${(v / max) * 100}%`, minHeight: v ? 2 : 0, background: "rgb(var(--chart-1))" }} />
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex text-[11px] text-muted" aria-hidden>
        {hours.map((h, i) => (
          <span key={h} className="flex-1 text-center">
            {i % 2 === 0 ? label(h) : ""}
          </span>
        ))}
      </div>
    </div>
  );
}


