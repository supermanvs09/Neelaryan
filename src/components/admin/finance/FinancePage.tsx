"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Download, Plus } from "lucide-react";
import { Badge, Button, Card, DataTable, Dialog, Empty, ErrorBlock, Field, Input, LoadingBlock, Notice, PageHeader, Segmented, Select, Stat, Tabs, Textarea, useConfirm, useToast } from "../ui";
import { useCan } from "../AdminShell";
import { apiFetch, qs, useApi, type ClientApiError } from "@/lib/api-client";
import { addDays, dateOf, istDate, money, pct } from "@/lib/format";
import { clsx } from "@/lib/clsx";

export interface Pnl {
  buckets: Bucket[];
  totals: Omit<Bucket, "key"> & { gross_margin: number | null; net_margin: number | null; food_cost_pct: number | null; avg_order: number | null };
  expenses_by_category: { name: string; amount: number }[];
  collections: { method: string; received: number; refunded: number; net: number }[];
  purchases: { count: number; total: number; paid: number };
  warnings: { uncosted_lines: number; unvalued_stock_movements: number };
}
interface Bucket {
  key: string;
  orders: number;
  orders_retail: number;
  orders_wholesale: number;
  revenue_retail: number;
  revenue_wholesale: number;
  revenue: number;
  discounts: number;
  gst: number;
  refunds: number;
  net_revenue: number;
  cogs: number;
  gross_profit: number;
  wastage: number;
  stock_adjustments: number;
  expenses: number;
  net_profit: number;
}

type Preset = "7d" | "30d" | "month" | "last_month" | "year" | "custom";

export function periodFor(p: Preset, today = istDate()) {
  const [y, m] = today.split("-").map(Number);
  const first = (yy: number, mm: number) => `${yy}-${String(mm).padStart(2, "0")}-01`;
  switch (p) {
    case "7d":
      return { from: addDays(today, -6), to: today };
    case "30d":
      return { from: addDays(today, -29), to: today };
    case "month":
      return { from: first(y, m), to: today };
    case "last_month": {
      const lm = m === 1 ? 12 : m - 1;
      const ly = m === 1 ? y - 1 : y;
      return { from: first(ly, lm), to: addDays(first(y, m), -1) };
    }
    case "year": {
      // Indian financial year: April → March
      const fy = m >= 4 ? y : y - 1;
      return { from: `${fy}-04-01`, to: today };
    }
    default:
      return { from: addDays(today, -6), to: today };
  }
}

export function bucketLabel(key: string, group: "day" | "week" | "month") {
  if (group === "month") return new Date(`${key}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });
  const d = new Date(`${key}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
  return group === "week" ? `Week of ${d}` : d;
}

export function PeriodPicker({ preset, setPreset, from, to, setRange, group, setGroup }: { preset: Preset; setPreset: (p: Preset) => void; from: string; to: string; setRange: (f: string, t: string) => void; group?: "day" | "week" | "month"; setGroup?: (g: "day" | "week" | "month") => void }) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Field label="Period" htmlFor="pp-preset">
        <Select
          id="pp-preset"
          value={preset}
          onChange={(e) => {
            const p = e.target.value as Preset;
            setPreset(p);
            if (p !== "custom") {
              const r = periodFor(p);
              setRange(r.from, r.to);
            }
          }}
        >
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="month">This month</option>
          <option value="last_month">Last month</option>
          <option value="year">This financial year</option>
          <option value="custom">Custom dates</option>
        </Select>
      </Field>
      {preset === "custom" && (
        <>
          <Field label="From" htmlFor="pp-from">
            <Input id="pp-from" type="date" value={from} max={to} onChange={(e) => setRange(e.target.value, to)} />
          </Field>
          <Field label="To" htmlFor="pp-to">
            <Input id="pp-to" type="date" value={to} min={from} max={istDate()} onChange={(e) => setRange(from, e.target.value)} />
          </Field>
        </>
      )}
      {group && setGroup && (
        <div className="pb-0.5">
          <Segmented label="Group by" value={group} onChange={setGroup} items={[{ value: "day", label: "Daily" }, { value: "week", label: "Weekly" }, { value: "month", label: "Monthly" }]} />
        </div>
      )}
    </div>
  );
}

export function FinancePage() {
  const [tab, setTab] = useState<"pnl" | "expenses">("pnl");
  const [preset, setPreset] = useState<Preset>("30d");
  const init = periodFor("30d");
  const [from, setFrom] = useState(init.from);
  const [to, setTo] = useState(init.to);
  const [group, setGroup] = useState<"day" | "week" | "month">("day");
  const setRange = (f: string, t: string) => {
    setFrom(f);
    setTo(t);
    const days = (Date.parse(t) - Date.parse(f)) / 86400000;
    if (days > 120 && group === "day") setGroup("month");
    else if (days > 45 && group === "day") setGroup("week");
  };

  return (
    <>
      <PageHeader title="Finance & P&L" description="Profit from real sales, ingredient costs, wastage and expenses. Amounts exclude GST unless stated." />
      <Tabs className="mb-4" value={tab} onChange={setTab} items={[{ value: "pnl", label: "Profit & loss" }, { value: "expenses", label: "Expenses" }]} />
      <div className="mb-4">
        <PeriodPicker preset={preset} setPreset={setPreset} from={from} to={to} setRange={setRange} group={tab === "pnl" ? group : undefined} setGroup={setGroup} />
      </div>
      {tab === "pnl" ? <PnlView from={from} to={to} group={group} /> : <ExpensesView from={from} to={to} />}
    </>
  );
}

function PnlView({ from, to, group }: { from: string; to: string; group: "day" | "week" | "month" }) {
  const params = { from, to, group };
  const { data, error, loading, reload } = useApi<Pnl>(`/api/admin/finance/pnl${qs(params)}`);
  if (error) return <ErrorBlock error={error} retry={reload} />;
  if (loading || !data) return <LoadingBlock rows={8} />;
  const t = data.totals;
  const hasWholesale = t.revenue_wholesale > 0;

  return (
    <div className="space-y-4">
      {(data.warnings.uncosted_lines > 0 || data.warnings.unvalued_stock_movements > 0) && (
        <Notice tone="warning">
          <AlertTriangle size={15} className="mr-1 inline" aria-hidden />
          {data.warnings.uncosted_lines > 0 && <>{data.warnings.uncosted_lines} sold item line(s) have no cost (no recipe or cost price), so profit is overstated. Add recipes in Menu. </>}
          {data.warnings.unvalued_stock_movements > 0 && <>{data.warnings.unvalued_stock_movements} wastage/adjustment(s) were on items with no cost yet.</>}
        </Notice>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Net revenue" value={money(t.net_revenue)} sub={`${t.orders} orders${t.avg_order ? ` · avg ${money(t.avg_order)}` : ""}`} />
        <Stat label="Gross profit" value={money(t.gross_profit)} sub={`Margin ${pct(t.gross_margin)} · food cost ${pct(t.food_cost_pct)}`} />
        <Stat label="Net profit" value={money(t.net_profit)} tone={t.net_profit < 0 ? "danger" : "success"} sub={`Margin ${pct(t.net_margin)}`} />
        <Stat label="GST collected" value={money(t.gst)} sub="Payable — not your income" />
      </div>

      <Card
        title="Revenue and net profit"
        description={`${bucketLabel(data.buckets[0]?.key ?? from, group)} – ${dateOf(to)}`}
        actions={
          <a href={`/api/admin/finance/pnl${qs({ ...params, format: "csv" })}`}>
            <Button size="sm" variant="secondary" icon={<Download size={14} />}>
              CSV
            </Button>
          </a>
        }
      >
        <TrendChart buckets={data.buckets} group={group} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card title="Statement" padded={false}>
          <table className="w-full text-[14px]">
            <tbody>
              {hasWholesale && (
                <>
                  <Line label="Retail sales" value={t.revenue_retail} indent sub={`${t.orders_retail} orders`} />
                  <Line label="Wholesale sales" value={t.revenue_wholesale} indent sub={`${t.orders_wholesale} orders`} />
                </>
              )}
              <Line label="Sales (ex GST)" value={t.revenue} strong sub={t.discounts ? `after ${money(t.discounts)} discounts` : undefined} />
              {t.refunds > 0 && <Line label="Refunds" value={-t.refunds} />}
              <Line label="Net revenue" value={t.net_revenue} strong />
              <Line label="Cost of goods sold" value={-t.cogs} sub="ingredients & products used" />
              <Line label="Gross profit" value={t.gross_profit} strong total sub={pct(t.gross_margin)} />
              <Line label="Wastage" value={-t.wastage} />
              {t.stock_adjustments !== 0 && <Line label={t.stock_adjustments > 0 ? "Stock losses (counts)" : "Stock gains (counts)"} value={-t.stock_adjustments} />}
              <Line label="Operating expenses" value={-t.expenses} />
              <Line label="Net profit" value={t.net_profit} strong total sub={pct(t.net_margin)} />
            </tbody>
          </table>
        </Card>
        <div className="space-y-4">
          <Card title="Expenses by category" padded={false}>
            {!data.expenses_by_category.length ? (
              <p className="p-4 text-[14px] text-muted">No expenses recorded in this period.</p>
            ) : (
              <ul className="divide-y divide-line text-[14px]">
                {data.expenses_by_category.map((e) => (
                  <li key={e.name} className="flex justify-between px-4 py-2">
                    <span>{e.name}</span>
                    <span className="num">{money(e.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Money collected" description="Payments taken, incl. GST" padded={false}>
            {!data.collections.length ? (
              <p className="p-4 text-[14px] text-muted">No payments in this period.</p>
            ) : (
              <ul className="divide-y divide-line text-[14px]">
                {data.collections.map((c) => (
                  <li key={c.method} className="flex justify-between px-4 py-2">
                    <span className="capitalize">{c.method === "upi" ? "UPI" : c.method}</span>
                    <span className="num">
                      {money(c.net)}
                      {c.refunded > 0 && <span className="ml-1 text-[12px] text-muted">({money(c.refunded)} refunded)</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Stock purchased" padded={false}>
            <p className="flex justify-between px-4 py-3 text-[14px]">
              <span>
                {data.purchases.count} purchase{data.purchases.count === 1 ? "" : "s"}
                {data.purchases.total - data.purchases.paid > 0.5 && <span className="text-warning"> · {money(data.purchases.total - data.purchases.paid)} unpaid</span>}
              </span>
              <span className="num">{money(data.purchases.total)}</span>
            </p>
            <p className="border-t border-line px-4 py-2 text-[12.5px] text-muted">Purchases become stock; their cost reaches profit as items are used or wasted.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Line({ label, value, strong, total, indent, sub }: { label: string; value: number; strong?: boolean; total?: boolean; indent?: boolean; sub?: string }) {
  return (
    <tr className={clsx("border-b border-line last:border-b-0", total && "bg-surface-2/60")}>
      <th scope="row" className={clsx("px-4 py-2 text-left font-normal", strong && "font-semibold", indent && "pl-8 text-muted")}>
        {label}
        {sub && <span className="ml-2 text-[12px] font-normal text-muted">{sub}</span>}
      </th>
      <td className={clsx("num px-4 py-2 text-right", strong && "font-semibold", total && value < 0 && "text-danger")}>{value < 0 ? `− ${money(-value)}` : money(value)}</td>
    </tr>
  );
}

/* ── Chart: grouped bars on one ₹ axis, zero baseline, hover tooltip ──────── */

function nice(max: number) {
  if (max <= 0) return 100;
  const p = 10 ** Math.floor(Math.log10(max));
  const n = max / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

const compact = (n: number) => {
  const a = Math.abs(n);
  const body = a >= 100000 ? `${(a / 100000).toFixed(1)}L` : a >= 1000 ? `${(a / 1000).toFixed(a % 1000 ? 1 : 0)}k` : `${Math.round(a)}`;
  return `${n < 0 ? "−" : ""}₹${body}`;
};

function TrendChart({ buckets, group }: { buckets: Bucket[]; group: "day" | "week" | "month" }) {
  const [hover, setHover] = useState<number | null>(null);
  const { top, bottom } = useMemo(() => {
    const hi = Math.max(0, ...buckets.map((b) => Math.max(b.net_revenue, b.net_profit)));
    const lo = Math.min(0, ...buckets.map((b) => Math.min(b.net_revenue, b.net_profit)));
    return { top: nice(hi), bottom: lo < 0 ? -nice(-lo) : 0 };
  }, [buckets]);
  if (!buckets.some((b) => b.net_revenue || b.net_profit)) return <Empty title="No sales or costs in this period" />;

  const H = 220;
  const span = top - bottom || 1;
  const y = (v: number) => ((top - v) / span) * H;
  const zero = y(0);
  const ticks = [top, top / 2, 0, ...(bottom < 0 ? [bottom] : [])];
  const n = buckets.length;
  const labelEvery = Math.ceil(n / 8);
  const h = hover !== null ? buckets[hover] : null;

  return (
    <div>
      <div className="mb-3 flex gap-4 text-[13px]">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[rgb(var(--chart-1))]" aria-hidden /> Net revenue
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[rgb(var(--chart-2))]" aria-hidden /> Net profit
        </span>
      </div>
      <div className="relative flex">
        <div className="relative w-12 shrink-0 text-right text-[11.5px] text-muted" style={{ height: H }} aria-hidden>
          {ticks.map((t) => (
            <span key={t} className="num absolute right-2 -translate-y-1/2" style={{ top: y(t) }}>
              {compact(t)}
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1" style={{ height: H }} onMouseLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <div key={t} className={clsx("absolute inset-x-0 border-t", t === 0 ? "border-line-strong" : "border-dashed border-line")} style={{ top: y(t) }} aria-hidden />
          ))}
          <div className="absolute inset-0 flex" role="img" aria-label="Net revenue and net profit by period. The statement table below lists the exact figures.">
            {buckets.map((b, i) => (
              <div
                key={b.key}
                className={clsx("relative flex h-full flex-1 justify-center gap-[2px]", hover === i && "bg-surface-2/70")}
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                tabIndex={-1}
              >
                {[
                  { v: b.net_revenue, c: "var(--chart-1)" },
                  { v: b.net_profit, c: "var(--chart-2)" },
                ].map((s, k) => {
                  const pos = s.v >= 0;
                  const hgt = Math.abs(y(s.v) - zero);
                  return (
                    <div
                      key={k}
                      className="absolute"
                      style={{
                        left: `calc(50% ${k === 0 ? "-" : "+"} ${k === 0 ? "min(10px, 22%)" : "1px"})`,
                        width: "min(9px, 21%)",
                        top: pos ? zero - hgt : zero,
                        height: Math.max(hgt, s.v ? 1 : 0),
                        background: `rgb(${s.c})`,
                        borderRadius: pos ? "4px 4px 0 0" : "0 0 4px 4px",
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
          {h && hover !== null && (
            <div
              className="pointer-events-none absolute top-0 z-10 w-52 rounded-lg border border-line bg-surface p-3 text-[12.5px] shadow-lg"
              style={{ left: `clamp(0px, calc(${((hover + 0.5) / n) * 100}% - 104px), calc(100% - 208px))` }}
            >
              <p className="mb-1 font-semibold">{bucketLabel(h.key, group)}</p>
              <TipRow color="var(--chart-1)" label="Net revenue" value={money(h.net_revenue)} />
              <TipRow color="var(--chart-2)" label="Net profit" value={money(h.net_profit)} />
              <p className="mt-1 border-t border-line pt-1 text-muted">
                {h.orders} orders · COGS {money(h.cogs)}
                {h.expenses > 0 && ` · expenses ${money(h.expenses)}`}
              </p>
            </div>
          )}
        </div>
      </div>
      <div className="ml-12 flex text-[11.5px] text-muted" aria-hidden>
        {buckets.map((b, i) => (
          <span key={b.key} className="flex flex-1 justify-center overflow-visible whitespace-nowrap pt-1.5">
            {i % labelEvery === 0 ? bucketLabel(b.key, group).replace("Week of ", "") : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

function TipRow({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <p className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-sm" style={{ background: `rgb(${color})` }} />
        {label}
      </span>
      <span className="num font-semibold">{value}</span>
    </p>
  );
}

/* ── Expenses ───────────────────────────────────────────────────────────── */

interface ExpenseRow {
  id: string;
  spent_on: string;
  category: string;
  category_id: string;
  amount: number;
  vendor: string;
  payment_method: string;
  notes: string;
  is_void: boolean;
  void_reason: string | null;
  created_by_name: string | null;
}

function ExpensesView({ from, to }: { from: string; to: string }) {
  const [category, setCategory] = useState("");
  const [showVoid, setShowVoid] = useState(false);
  const params = { from, to, category: category || undefined, include_void: showVoid ? "1" : "0" };
  const { data, error, loading, reload } = useApi<{ expenses: ExpenseRow[]; categories: { id: string; name: string }[] }>(`/api/admin/expenses${qs(params)}`);
  const can = useCan();
  const toast = useToast();
  const { ask, node } = useConfirm();
  const [adding, setAdding] = useState(false);
  const rows = data?.expenses ?? [];
  const total = rows.filter((r) => !r.is_void).reduce((s, r) => s + Number(r.amount), 0);

  const voidIt = async (e: ExpenseRow) => {
    const r = await ask({ title: `Void ${money(Number(e.amount))} ${e.category}?`, body: "It stays on record, marked void, and no longer counts in the P&L.", reason: { label: "Why?", required: true }, confirm: "Void expense", danger: true });
    if (!r.ok) return;
    try {
      await apiFetch(`/api/admin/expenses/${e.id}/void`, { body: { reason: r.reason } });
      toast("Expense voided");
      reload();
    } catch (err) {
      toast((err as ClientApiError).message, "error");
    }
  };

  return (
    <Card
      padded={false}
      title={`Expenses · ${money(total)}`}
      actions={
        <>
          <a href={`/api/admin/expenses${qs({ from, to, category: category || undefined, format: "csv" })}`}>
            <Button size="sm" variant="secondary" icon={<Download size={14} />}>
              CSV
            </Button>
          </a>
          {can("expenses.manage") && (
            <Button size="sm" icon={<Plus size={14} />} onClick={() => setAdding(true)}>
              Add expense
            </Button>
          )}
        </>
      }
    >
      {node}
      <div className="flex flex-wrap items-center gap-3 border-b border-line p-3">
        <Select aria-label="Category" className="w-auto" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {(data?.categories ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <label className="flex items-center gap-2 text-[13.5px]">
          <input type="checkbox" checked={showVoid} onChange={(e) => setShowVoid(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--primary))]" />
          Show voided
        </label>
      </div>
      <ErrorBlock error={error} retry={reload} />
      {loading ? (
        <div className="p-4">
          <LoadingBlock rows={5} />
        </div>
      ) : (
        <DataTable
          rows={rows}
          rowKey={(r) => r.id}
          empty={<Empty title="No expenses in this period">Record rent, wages, utilities and other running costs to see your true net profit.</Empty>}
          columns={[
            { key: "d", header: "Date", cell: (r) => dateOf(r.spent_on) },
            { key: "c", header: "Category", primary: true, cell: (r) => <span className={clsx("font-semibold", r.is_void && "text-muted line-through")}>{r.category}</span> },
            { key: "v", header: "Paid to", cell: (r) => r.vendor || <span className="text-muted">—</span> },
            { key: "m", header: "Method", hideOnCard: true, cell: (r) => (r.payment_method === "upi" ? "UPI" : r.payment_method[0].toUpperCase() + r.payment_method.slice(1)) },
            { key: "n", header: "Notes", hideOnCard: true, cell: (r) => (r.is_void ? <Badge tone="danger">Void: {r.void_reason}</Badge> : <span className="text-muted">{r.notes || "—"}</span>) },
            { key: "a", header: "Amount", align: "right", cell: (r) => <span className={clsx("num font-semibold", r.is_void && "text-muted line-through")}>{money(Number(r.amount))}</span> },
            {
              key: "x",
              header: <span className="sr-only">Actions</span>,
              align: "right",
              hideOnCard: true,
              cell: (r) =>
                !r.is_void && can("expenses.manage") && (
                  <Button size="sm" variant="ghost" onClick={() => voidIt(r)}>
                    Void
                  </Button>
                ),
            },
          ]}
        />
      )}
      {adding && data && <ExpenseForm categories={data.categories} onClose={() => setAdding(false)} onSaved={reload} />}
    </Card>
  );
}

function ExpenseForm({ categories, onClose, onSaved }: { categories: { id: string; name: string }[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ category_id: "", amount: "", spent_on: istDate(), vendor: "", payment_method: "cash", notes: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<ClientApiError | null>(null);
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const save = async (again: boolean) => {
    setBusy(true);
    setErr(null);
    try {
      await apiFetch("/api/admin/expenses", { body: { ...f, amount: Number(f.amount) } });
      toast(`Expense of ${money(Number(f.amount))} recorded`);
      onSaved();
      if (again) setF((x) => ({ ...x, amount: "", vendor: "", notes: "" }));
      else onClose();
    } catch (e) {
      setErr(e as ClientApiError);
    } finally {
      setBusy(false);
    }
  };
  const fe = err?.fields ?? {};
  const ok = f.category_id && Number(f.amount) > 0;
  return (
    <Dialog
      open
      size="sm"
      onClose={onClose}
      title="Add expense"
      footer={
        <>
          <Button variant="secondary" onClick={() => save(true)} disabled={!ok} loading={busy}>
            Save & add another
          </Button>
          <Button onClick={() => save(false)} disabled={!ok} loading={busy}>
            Save
          </Button>
        </>
      }
    >
      {err && !err.fields && <Notice tone="danger" className="mb-3">{err.message}</Notice>}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Category" htmlFor="ex-cat" error={fe.category_id} className="col-span-2">
          <Select id="ex-cat" value={f.category_id} onChange={(e) => set({ category_id: e.target.value })}>
            <option value="">Choose…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Amount" htmlFor="ex-amt" error={fe.amount}>
          <Input id="ex-amt" prefix="₹" inputMode="decimal" value={f.amount} onChange={(e) => set({ amount: e.target.value.replace(/[^\d.]/g, "") })} />
        </Field>
        <Field label="Date" htmlFor="ex-date" error={fe.spent_on}>
          <Input id="ex-date" type="date" value={f.spent_on} max={istDate()} onChange={(e) => set({ spent_on: e.target.value })} />
        </Field>
        <Field label="Paid to" htmlFor="ex-ven" optional>
          <Input id="ex-ven" value={f.vendor} maxLength={80} onChange={(e) => set({ vendor: e.target.value })} />
        </Field>
        <Field label="Paid by" htmlFor="ex-pm">
          <Select id="ex-pm" value={f.payment_method} onChange={(e) => set({ payment_method: e.target.value })}>
            <option value="cash">Cash</option>
            <option value="upi">UPI</option>
            <option value="card">Card</option>
            <option value="bank">Bank transfer</option>
            <option value="other">Other</option>
          </Select>
        </Field>
        <Field label="Notes" htmlFor="ex-notes" optional className="col-span-2">
          <Textarea id="ex-notes" rows={2} maxLength={300} value={f.notes} onChange={(e) => set({ notes: e.target.value })} />
        </Field>
      </div>
    </Dialog>
  );
}
