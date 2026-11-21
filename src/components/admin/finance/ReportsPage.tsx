"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Badge, Button, Card, DataTable, Empty, ErrorBlock, LoadingBlock, PageHeader, Tabs } from "../ui";
import { qs, useApi } from "@/lib/api-client";
import { dateOf, dateTime, money, pct } from "@/lib/format";
import { PeriodPicker, periodFor } from "./FinancePage";
import { clsx } from "@/lib/clsx";
import { CLASS_INFO, type InsightRow, type MenuClass } from "@/lib/analytics";

type Kind = "items" | "insights" | "hours" | "tax" | "payments" | "orders";
const TABS: { value: Kind; label: string; about: string }[] = [
  { value: "items", label: "Sales by item", about: "What sells, and what each item earns after its cost. Completed orders only." },
  { value: "insights", label: "Menu insights", about: "Each item sorted by how popular it is and how much it earns per sale — with what to do about it. Uses recipe or cost prices; completed orders only." },
  { value: "hours", label: "Busy hours", about: "Orders by day of week and hour — plan staff and prep around the peaks." },
  { value: "tax", label: "GST summary", about: "Taxable value and GST per day for filing. CGST and SGST are each half of the GST charged." },
  { value: "payments", label: "Payments", about: "Every payment and refund taken, by method — reconcile with your cash drawer and UPI statements." },
  { value: "orders", label: "Orders", about: "Every order placed in the period, in any status." },
];

export function ReportsPage() {
  const [kind, setKind] = useState<Kind>("items");
  const [preset, setPreset] = useState<Parameters<typeof periodFor>[0]>("30d");
  const init = periodFor("30d");
  const [from, setFrom] = useState(init.from);
  const [to, setTo] = useState(init.to);
  const tab = TABS.find((t) => t.value === kind)!;
  const url = `/api/admin/reports/${kind}${qs({ from, to })}`;

  return (
    <>
      <PageHeader title="Reports" description="Every report downloads as a spreadsheet (CSV) for your accountant." />
      <Tabs className="mb-4" value={kind} onChange={setKind} items={TABS.map(({ value, label }) => ({ value, label }))} />
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <PeriodPicker preset={preset} setPreset={setPreset} from={from} to={to} setRange={(f, t) => { setFrom(f); setTo(t); }} />
        {kind !== "insights" && (
          <a href={`/api/admin/reports/${kind}${qs({ from, to, format: "csv" })}`}>
            <Button variant="secondary" icon={<Download size={15} />}>
              Download CSV
            </Button>
          </a>
        )}
      </div>
      <p className="mb-3 text-[13.5px] text-muted">{tab.about}</p>
      {kind === "items" && <ItemsReport url={url} />}
      {kind === "insights" && <InsightsReport url={`/api/admin/insights${qs({ from, to })}`} />}
      {kind === "hours" && <HoursReport url={url} />}
      {kind === "tax" && <TaxReport url={url} />}
      {kind === "payments" && <PaymentsReport url={url} />}
      {kind === "orders" && <OrdersReport url={url} />}
    </>
  );
}

function useReport<T>(url: string) {
  const r = useApi<T>(url);
  const wrap = (render: (d: T) => React.ReactNode) => (r.error ? <ErrorBlock error={r.error} retry={r.reload} /> : r.loading || !r.data ? <LoadingBlock rows={6} /> : render(r.data));
  return wrap;
}

interface ItemRow {
  name: string;
  category: string | null;
  source: string;
  qty: number;
  revenue: number;
  cost: number | null;
  profit: number | null;
  margin: number | null;
}

function ItemsReport({ url }: { url: string }) {
  const wrap = useReport<{ items: ItemRow[]; note: string }>(url);
  const [sort, setSort] = useState<"revenue" | "qty" | "profit">("revenue");
  return wrap((d) => {
    const rows = [...d.items].sort((a, b) => (Number(b[sort] ?? -Infinity) || 0) - (Number(a[sort] ?? -Infinity) || 0));
    const total = d.items.reduce((s, r) => s + r.revenue, 0);
    return (
      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2 text-[13px]">
          <span className="text-muted">Sort by</span>
          {(["revenue", "qty", "profit"] as const).map((k) => (
            <button key={k} type="button" onClick={() => setSort(k)} className={clsx("rounded-full px-2.5 py-1 font-semibold", sort === k ? "bg-primary text-primary-fg" : "hover:bg-surface-2")}>
              {k === "revenue" ? "Sales" : k === "qty" ? "Quantity" : "Profit"}
            </button>
          ))}
          <span className="ml-auto text-[12px] text-muted">{d.note}</span>
        </div>
        <DataTable
          dense
          rows={rows}
          rowKey={(r) => `${r.source}-${r.name}`}
          empty={<Empty title="No completed sales in this period" />}
          columns={[
            { key: "n", header: "Item", primary: true, cell: (r) => <span className="font-semibold">{r.name} {r.source === "product" && <Badge tone="primary">Product</Badge>}</span> },
            { key: "c", header: "Category", hideOnCard: true, cell: (r) => r.category ?? "—" },
            { key: "q", header: "Sold", align: "right", cell: (r) => <span className="num">{r.qty}</span> },
            {
              key: "r",
              header: "Sales",
              align: "right",
              cell: (r) => (
                <span className="num">
                  {money(r.revenue)} <span className="text-[12px] text-muted">{total ? `${((r.revenue / total) * 100).toFixed(0)}%` : ""}</span>
                </span>
              ),
            },
            { key: "co", header: "Cost", align: "right", cell: (r) => (r.cost === null ? <span className="text-[12.5px] text-warning">No cost set</span> : <span className="num">{money(r.cost)}</span>) },
            { key: "p", header: "Profit", align: "right", cell: (r) => <span className="num font-semibold">{r.profit === null ? "—" : money(r.profit)}</span> },
            { key: "m", header: "Margin", align: "right", cell: (r) => <span className={clsx("num", r.margin !== null && r.margin < 0.5 && "text-warning")}>{pct(r.margin, 0)}</span> },
          ]}
        />
      </Card>
    );
  });
}

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function HoursReport({ url }: { url: string }) {
  const wrap = useReport<{ cells: { dow: number; hour: number; orders: number; revenue: number }[] }>(url);
  return wrap((d) => <Heatmap cells={d.cells} />);
}

function Heatmap({ cells }: { cells: { dow: number; hour: number; orders: number; revenue: number }[] }) {
  const { hours, max, grid } = useMemo(() => {
    const hs = cells.map((c) => c.hour);
    const lo = hs.length ? Math.min(...hs) : 8;
    const hi = hs.length ? Math.max(...hs) : 22;
    const g = new Map(cells.map((c) => [`${c.dow}-${c.hour}`, c]));
    return { hours: Array.from({ length: hi - lo + 1 }, (_, i) => lo + i), max: Math.max(1, ...cells.map((c) => c.orders)), grid: g };
  }, [cells]);
  if (!cells.length) return <Empty title="No completed orders in this period" />;
  const h12 = (h: number) => `${h % 12 || 12}${h < 12 ? "a" : "p"}`;
  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-[2px] text-[12px]">
          <thead>
            <tr>
              <th />
              {hours.map((h) => (
                <th key={h} scope="col" className="w-10 font-normal text-muted">
                  {h12(h)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DOW.map((dn, i) => (
              <tr key={dn}>
                <th scope="row" className="pr-2 text-left font-semibold">
                  {dn}
                </th>
                {hours.map((h) => {
                  const c = grid.get(`${i + 1}-${h}`);
                  const a = c ? 0.12 + 0.88 * (c.orders / max) : 0;
                  return (
                    <td
                      key={h}
                      title={c ? `${dn} ${h12(h)}: ${c.orders} orders · ${money(c.revenue)}` : `${dn} ${h12(h)}: no orders`}
                      className="h-9 w-10 rounded text-center"
                      style={{ background: c ? `rgb(var(--chart-1) / ${a})` : "rgb(var(--surface-2) / 0.6)", color: a > 0.55 ? "#fff" : undefined }}
                    >
                      {c ? <span className="num">{c.orders}</span> : ""}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[12.5px] text-muted">Numbers are completed orders placed in that hour. Darker = busier.</p>
    </Card>
  );
}

function TaxReport({ url }: { url: string }) {
  const wrap = useReport<{ days: { d: string; orders: number; taxable: number; cgst: number; sgst: number; gst: number; total: number }[] }>(url);
  return wrap((d) => {
    const sum = (k: "orders" | "taxable" | "cgst" | "sgst" | "gst" | "total") => d.days.reduce((s, r) => s + r[k], 0);
    return (
      <Card padded={false}>
        <DataTable
          dense
          rows={d.days}
          rowKey={(r) => r.d}
          empty={<Empty title="No completed sales in this period" />}
          columns={[
            { key: "d", header: "Date", primary: true, cell: (r) => dateOf(r.d) },
            { key: "o", header: "Bills", align: "right", cell: (r) => <span className="num">{r.orders}</span> },
            { key: "t", header: "Taxable value", align: "right", cell: (r) => <span className="num">{money(r.taxable)}</span> },
            { key: "c", header: "CGST", align: "right", cell: (r) => <span className="num">{money(r.cgst)}</span> },
            { key: "s", header: "SGST", align: "right", cell: (r) => <span className="num">{money(r.sgst)}</span> },
            { key: "g", header: "Total GST", align: "right", cell: (r) => <span className="num font-semibold">{money(r.gst)}</span> },
            { key: "v", header: "Invoice value", align: "right", cell: (r) => <span className="num">{money(r.total)}</span> },
          ]}
          footer={
            <tr className="bg-surface-2/60 font-semibold">
              <th scope="row" className="px-4 py-2 text-left">Total</th>
              {(["orders", "taxable", "cgst", "sgst", "gst", "total"] as const).map((k) => (
                <td key={k} className="num px-4 py-2 text-right">
                  {k === "orders" ? sum(k) : money(sum(k))}
                </td>
              ))}
            </tr>
          }
        />
      </Card>
    );
  });
}

function PaymentsReport({ url }: { url: string }) {
  const wrap = useReport<{ payments: { created_at: string; kind: string; method: string; amount: number; reference: string; number: number; by: string | null }[] }>(url);
  return wrap((d) => {
    const byMethod = new Map<string, number>();
    for (const p of d.payments) byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + (p.kind === "refund" ? -1 : 1) * Number(p.amount));
    return (
      <>
        {byMethod.size > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {[...byMethod].map(([m, v]) => (
              <span key={m} className="rounded-lg border border-line bg-surface px-3 py-2 text-[13.5px]">
                <span className="text-muted">{m === "upi" ? "UPI" : m[0].toUpperCase() + m.slice(1)}</span> <b className="num">{money(v)}</b>
              </span>
            ))}
          </div>
        )}
        <Card padded={false}>
          <DataTable
            dense
            rows={d.payments}
            rowKey={(r) => `${r.created_at}-${r.number}-${r.amount}-${r.kind}`}
            empty={<Empty title="No payments in this period" />}
            columns={[
              { key: "w", header: "When", cell: (r) => dateTime(r.created_at) },
              { key: "o", header: "Order", primary: true, cell: (r) => <span className="font-semibold">#{r.number}</span> },
              { key: "m", header: "Method", cell: (r) => (r.method === "upi" ? "UPI" : r.method[0].toUpperCase() + r.method.slice(1)) },
              { key: "r", header: "Reference", hideOnCard: true, cell: (r) => r.reference || "—" },
              { key: "b", header: "Taken by", hideOnCard: true, cell: (r) => r.by ?? "—" },
              { key: "a", header: "Amount", align: "right", cell: (r) => <span className={clsx("num font-semibold", r.kind === "refund" && "text-danger")}>{r.kind === "refund" ? `− ${money(Number(r.amount))}` : money(Number(r.amount))}</span> },
            ]}
          />
        </Card>
      </>
    );
  });
}

function OrdersReport({ url }: { url: string }) {
  const wrap = useReport<{ orders: { number: number; created_at: string; type: string; table_label: string | null; status: string; payment_status: string; customer_name: string; total: number; items: string; price_tier: string }[] }>(url);
  return wrap((d) => (
    <Card padded={false}>
      <DataTable
        dense
        rows={[...d.orders].reverse()}
        rowKey={(r) => String(r.number)}
        empty={<Empty title="No orders in this period" />}
        columns={[
          { key: "n", header: "Order", primary: true, cell: (r) => <span className="font-semibold">#{r.number}</span> },
          { key: "w", header: "Placed", cell: (r) => dateTime(r.created_at) },
          { key: "t", header: "Type", cell: (r) => (r.type === "dine_in" ? `Table ${r.table_label ?? ""}` : r.price_tier === "wholesale" ? "Wholesale" : "Takeaway") },
          { key: "i", header: "Items", hideOnCard: true, cell: (r) => <span className="line-clamp-1 max-w-[280px] text-muted">{r.items}</span> },
          { key: "s", header: "Status", cell: (r) => <span className="capitalize">{r.status}</span> },
          { key: "p", header: "Payment", hideOnCard: true, cell: (r) => <span className="capitalize">{r.payment_status}</span> },
          { key: "a", header: "Total", align: "right", cell: (r) => <span className="num font-semibold">{money(Number(r.total))}</span> },
        ]}
      />
    </Card>
  ));
}

const CLASS_TONE: Record<MenuClass, "success" | "warning" | "primary" | "danger" | "neutral"> = { star: "success", plowhorse: "warning", puzzle: "primary", dog: "danger", unknown: "neutral" };

function InsightsReport({ url }: { url: string }) {
  const wrap = useReport<{ totalUnits: number; popularAt: number; averageMargin: number | null; rows: InsightRow[] }>(url);
  const [filter, setFilter] = useState<MenuClass | "all">("all");
  return wrap((d) => {
    const counts = (Object.keys(CLASS_INFO) as MenuClass[]).map((k) => ({ k, n: d.rows.filter((r) => r.klass === k).length }));
    const rows = filter === "all" ? d.rows : d.rows.filter((r) => r.klass === filter);
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {counts.map(({ k, n }) => (
            <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(filter === k ? "all" : k)} className={clsx("rounded-lg border bg-surface p-3 text-left hover:border-line-strong", filter === k ? "border-primary ring-2 ring-primary/20" : "border-line")}>
              <span className="flex items-center justify-between gap-2">
                <Badge tone={CLASS_TONE[k]}>{CLASS_INFO[k].label}</Badge>
                <span className="num text-[18px] font-bold">{n}</span>
              </span>
              <span className="mt-1.5 block text-[12.5px] text-muted">{CLASS_INFO[k].hint}</span>
            </button>
          ))}
        </div>
        {filter !== "all" && <p className="rounded-lg bg-surface-2 px-3 py-2 text-[13.5px]"><b>What to do:</b> {CLASS_INFO[filter].action}</p>}
        <Card padded={false} description={`${d.totalUnits} items sold. “Popular” means at least ${d.popularAt.toFixed(1)} sold; average profit per item ${d.averageMargin === null ? "—" : money(d.averageMargin)}.`}>
          <DataTable
            rows={rows}
            rowKey={(r) => r.menu_item_id ?? r.name}
            empty={<Empty title="No sales in this period" />}
            columns={[
              { key: "n", header: "Item", primary: true, cell: (r) => <span className="font-semibold">{r.name}</span> },
              { key: "k", header: "Group", cell: (r) => <Badge tone={CLASS_TONE[r.klass]}>{CLASS_INFO[r.klass].label}</Badge> },
              { key: "q", header: "Sold", align: "right", cell: (r) => <span className="num">{r.qty}</span> },
              { key: "m", header: "Share", align: "right", hideOnCard: true, cell: (r) => <span className="num">{pct(r.mix)}</span> },
              { key: "s", header: "Sales", align: "right", cell: (r) => <span className="num">{money(r.sales)}</span> },
              { key: "u", header: "Profit / item", align: "right", cell: (r) => <span className="num">{r.marginPerUnit === null ? "—" : money(r.marginPerUnit)}</span> },
              { key: "p", header: "Margin", align: "right", hideOnCard: true, cell: (r) => <span className="num">{pct(r.marginPct)}</span> },
            ]}
          />
        </Card>
      </div>
    );
  });
}
