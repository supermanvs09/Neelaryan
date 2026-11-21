"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, BellOff, Plus, Search, Download } from "lucide-react";
import { Badge, Button, Card, DataTable, Empty, ErrorBlock, Input, LoadingBlock, PageHeader, Segmented, Select, Tabs } from "../ui";
import { useCan } from "../AdminShell";
import { qs, useApi } from "@/lib/api-client";
import { ago, addDays, istDate, money, timeOf } from "@/lib/format";
import { clsx } from "@/lib/clsx";
import { OrderDrawer } from "./OrderDrawer";
import { chime, minutesSince, modifierText, PaymentBadge, StatusBadge, typeLabel, type OrderRow, type OrderStatus } from "./shared";

const COLUMNS: { key: string; title: string; statuses: OrderStatus[]; hint: string }[] = [
  { key: "new", title: "New", statuses: ["new"], hint: "Waiting to be accepted" },
  { key: "kitchen", title: "In the kitchen", statuses: ["accepted", "preparing"], hint: "Accepted or being prepared" },
  { key: "ready", title: "Ready", statuses: ["ready"], hint: "Serve or hand over" },
  { key: "served", title: "Served · to settle", statuses: ["served"], hint: "Waiting for payment" },
];

export function OrdersPage() {
  const [tab, setTab] = useState<"board" | "history">("board");
  const [open, setOpen] = useState<string | null>(null);
  // Deep link from the counter screen: /admin/orders?open=<id>
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("open");
    if (id) {
      setOpen(id);
      window.history.replaceState(null, "", "/admin/orders");
    }
  }, []);
  const can = useCan();
  return (
    <>
      <PageHeader
        title="Orders"
        description="Dine-in (table QR), takeaway and counter orders in one place."
        actions={
          can("orders.create") && (
            <Link href="/admin/orders/new">
              <Button icon={<Plus size={16} />}>New order</Button>
            </Link>
          )
        }
      />
      <Tabs
        value={tab}
        onChange={setTab}
        className="mb-4"
        items={[
          { value: "board", label: "Live board" },
          { value: "history", label: "All orders" },
        ]}
      />
      {tab === "board" ? <Board onOpen={setOpen} /> : <History onOpen={setOpen} />}
      {open && <OrderDrawer id={open} onClose={() => setOpen(null)} onChanged={() => window.dispatchEvent(new Event("orders:changed"))} />}
    </>
  );
}

function Board({ onOpen }: { onOpen: (id: string) => void }) {
  const [type, setType] = useState<"all" | "dine_in" | "takeaway">("all");
  const [sound, setSound] = useState(false);
  const { data, error, loading, reload } = useApi<{ orders: OrderRow[] }>(`/api/admin/orders${qs({ view: "active" })}`, { refreshMs: 5000 });
  const seen = useRef<Set<string> | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    const onChange = () => void reload();
    window.addEventListener("orders:changed", onChange);
    try {
      setSound(localStorage.getItem("nr-order-sound") === "1");
    } catch {
      /* ignore */
    }
    return () => {
      clearInterval(t);
      window.removeEventListener("orders:changed", onChange);
    };
  }, [reload]);

  // chime when an order we haven't seen arrives
  useEffect(() => {
    if (!data) return;
    const ids = new Set(data.orders.filter((o) => o.status === "new").map((o) => o.id));
    if (seen.current && sound && [...ids].some((id) => !seen.current!.has(id))) chime();
    seen.current = new Set([...(seen.current ?? []), ...ids]);
  }, [data, sound]);

  const orders = useMemo(() => (data?.orders ?? []).filter((o) => type === "all" || o.type === type), [data, type]);
  const today = (data?.orders ?? []).filter((o) => o.status === "completed");
  const takings = today.reduce((s, o) => s + Number(o.amount_paid), 0);

  const toggleSound = () => {
    const v = !sound;
    setSound(v);
    if (v) chime();
    try {
      localStorage.setItem("nr-order-sound", v ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Segmented
          label="Order type"
          value={type}
          onChange={setType}
          items={[
            { value: "all", label: "All" },
            { value: "dine_in", label: "Dine-in" },
            { value: "takeaway", label: "Takeaway" },
          ]}
        />
        <Button variant="secondary" size="sm" icon={sound ? <Bell size={15} /> : <BellOff size={15} />} onClick={toggleSound} aria-pressed={sound}>
          New-order sound {sound ? "on" : "off"}
        </Button>
        <span className="ml-auto text-[13px] text-muted">
          Completed today: <b className="num text-fg">{today.length}</b> · collected <b className="num text-fg">{money(takings)}</b>
        </span>
      </div>
      <ErrorBlock error={error} retry={reload} />
      {loading ? (
        <LoadingBlock rows={6} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map((c) => {
            const list = orders.filter((o) => c.statuses.includes(o.status));
            return (
              <section key={c.key} aria-labelledby={`col-${c.key}`} className="min-w-0">
                <h2 id={`col-${c.key}`} className="mb-2 flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide text-muted">
                  {c.title}
                  <span className="num rounded-md bg-surface-2 px-1.5 text-fg">{list.length}</span>
                </h2>
                <div className="space-y-2">
                  {list.length === 0 && <p className="rounded-lg border border-dashed border-line px-3 py-6 text-center text-[13px] text-muted">{c.hint}</p>}
                  {list.map((o) => {
                    const mins = minutesSince(o.created_at, now);
                    return (
                      <button key={o.id} onClick={() => onOpen(o.id)} className={clsx("w-full rounded-lg border bg-surface p-3 text-left transition-colors hover:border-line-strong", o.status === "new" ? "border-accent" : "border-line")}>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="num text-[16px] font-bold">#{o.number}</p>
                            <p className="text-[12.5px] font-semibold text-accent-text">{typeLabel(o)}</p>
                          </div>
                          <span className={clsx("num text-[12px]", mins >= 20 && o.status !== "served" ? "font-bold text-danger" : "text-muted")}>{mins ? `${mins} min` : "now"}</span>
                        </div>
                        <ul className="mt-2 space-y-0.5 text-[13px]">
                          {o.items.slice(0, 4).map((i, k) => (
                            <li key={k} className="truncate">
                              <b className="num">{i.qty}×</b> {i.name}
                              {i.modifiers.length > 0 && <span className="text-muted"> · {modifierText(i.modifiers)}</span>}
                            </li>
                          ))}
                          {o.items.length > 4 && <li className="text-muted">+{o.items.length - 4} more</li>}
                        </ul>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className="num text-[13.5px] font-semibold">{money(o.total)}</span>
                          <PaymentBadge status={o.payment_status} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}

function History({ onOpen }: { onOpen: (id: string) => void }) {
  const [from, setFrom] = useState(addDays(istDate(), -6));
  const [to, setTo] = useState(istDate());
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [payment, setPayment] = useState("");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const params = { view: "history", from, to, type, status, payment, q: query };
  const { data, error, loading, reload } = useApi<{ orders: OrderRow[] }>(`/api/admin/orders${qs(params)}`);
  const rows = data?.orders ?? [];
  const total = rows.filter((o) => !["cancelled", "rejected"].includes(o.status)).reduce((s, o) => s + Number(o.total), 0);

  return (
    <Card padded={false}>
      <form
        className="flex flex-wrap items-end gap-2 border-b border-line p-3"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(q);
        }}
      >
        <label className="text-[12.5px] text-muted">
          From
          <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-[150px]" />
        </label>
        <label className="text-[12.5px] text-muted">
          To
          <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="mt-1 w-[150px]" />
        </label>
        <Select value={type} onChange={(e) => setType(e.target.value)} className="w-auto" aria-label="Type">
          <option value="">All types</option>
          <option value="dine_in">Dine-in</option>
          <option value="takeaway">Takeaway</option>
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto" aria-label="Status">
          <option value="">Any status</option>
          {["new", "accepted", "preparing", "ready", "served", "completed", "cancelled", "rejected"].map((s) => (
            <option key={s} value={s}>
              {s[0].toUpperCase() + s.slice(1)}
            </option>
          ))}
        </Select>
        <Select value={payment} onChange={(e) => setPayment(e.target.value)} className="w-auto" aria-label="Payment">
          <option value="">Any payment</option>
          <option value="unpaid">Unpaid</option>
          <option value="partial">Part paid</option>
          <option value="paid">Paid</option>
          <option value="refunded">Refunded</option>
        </Select>
        <div className="relative min-w-[180px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Order #, name or phone" className="pl-9" aria-label="Search orders" />
        </div>
        <Button type="submit" variant="secondary">
          Search
        </Button>
        <a href={`/api/admin/reports/orders${qs({ from, to, type, status })}`} className="inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-[13.5px] font-semibold text-primary hover:bg-surface-2">
          <Download size={15} /> CSV
        </a>
      </form>
      <ErrorBlock error={error} retry={reload} />
      {loading ? (
        <LoadingBlock />
      ) : (
        <>
          <p className="border-b border-line px-4 py-2 text-[13px] text-muted">
            {rows.length} orders · <span className="num">{money(total)}</span> excluding cancelled
          </p>
          <DataTable
            rows={rows}
            rowKey={(o) => o.id}
            onRowClick={(o) => onOpen(o.id)}
            empty={<Empty title="No orders found">Try a wider date range or fewer filters.</Empty>}
            columns={[
              { key: "no", header: "Order", primary: true, cell: (o) => <span className="num font-semibold">#{o.number}</span> },
              { key: "when", header: "Placed", cell: (o) => <span title={o.created_at}>{ago(o.created_at)} · {timeOf(o.created_at)}</span> },
              { key: "type", header: "Type", cell: (o) => typeLabel(o) },
              { key: "customer", header: "Customer", cell: (o) => o.customer_name || <span className="text-muted">Walk-in</span> },
              { key: "status", header: "Status", cell: (o) => <StatusBadge status={o.status} /> },
              { key: "pay", header: "Payment", cell: (o) => <PaymentBadge status={o.payment_status} refundDue={["cancelled", "rejected"].includes(o.status) && Number(o.amount_paid) > 0} /> },
              { key: "total", header: "Total", align: "right", cell: (o) => <span className="num">{money(o.total)}</span> },
              { key: "tier", header: "", hideOnCard: true, cell: (o) => (o.price_tier === "wholesale" ? <Badge tone="accent">Wholesale</Badge> : null) },
            ]}
          />
        </>
      )}
    </Card>
  );
}
