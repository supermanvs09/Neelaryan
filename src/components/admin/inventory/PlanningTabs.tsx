"use client";

import { useState } from "react";
import { Copy, Share2, ShoppingCart } from "lucide-react";
import { Badge, Button, Card, DataTable, Empty, ErrorBlock, LoadingBlock, Notice, Segmented, useToast } from "../ui";
import { qs, useApi } from "@/lib/api-client";
import { money, pct } from "@/lib/format";
import { formatQty } from "@/lib/units";
import type { ShoppingRow, UsageRow } from "@/lib/analytics";

interface Planning {
  from: string;
  to: string;
  cover: number;
  shopping: ShoppingRow[];
  usage: UsageRow[];
}

const usePlanning = (cover: number) => useApi<Planning>(`/api/admin/planning${qs({ cover })}`);
const days = (n: number | null) => (n === null ? "—" : n < 1 ? "Today" : `${n.toFixed(n < 10 ? 1 : 0)} days`);

/** What to buy so stock lasts N days, from the last 14 days of real use. */
export function ShoppingListTab() {
  const toast = useToast();
  const [cover, setCover] = useState<"2" | "3" | "7">("3");
  const { data, error, loading, reload } = usePlanning(Number(cover));
  const total = (data?.shopping ?? []).reduce((s, r) => s + (r.estimatedCost ?? 0), 0);
  const text = data
    ? [`Shopping list — enough for ${cover} days`, ...data.shopping.map((r) => `• ${r.item.name}: ${formatQty(r.buy, r.item.display_unit)}${r.item.supplier ? ` (${r.item.supplier})` : ""}`), total ? `Approx. ${money(total)}` : ""].filter(Boolean).join("\n")
    : "";
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Segmented
          label="Buy enough for"
          value={cover}
          onChange={setCover}
          items={[
            { value: "2", label: "2 days" },
            { value: "3", label: "3 days" },
            { value: "7", label: "A week" },
          ]}
        />
        {!!data?.shopping.length && (
          <span className="ml-auto flex gap-2">
            <Button variant="secondary" size="sm" icon={<Copy size={14} />} onClick={() => navigator.clipboard?.writeText(text).then(() => toast("List copied"), () => undefined)}>
              Copy
            </Button>
            <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">
              <Button variant="secondary" size="sm" icon={<Share2 size={14} />}>
                WhatsApp
              </Button>
            </a>
          </span>
        )}
      </div>
      <p className="mb-3 text-[13.5px] text-muted">Based on how much was really used from {data?.from ?? "…"} to {data?.to ?? "…"} (orders, logged use and waste). Each item is topped up to cover the days chosen and still end at its minimum level.</p>
      <ErrorBlock error={error} retry={reload} />
      {loading && !data ? (
        <LoadingBlock rows={6} />
      ) : data ? (
        <Card padded={false} title={data.shopping.length ? `${data.shopping.length} items to buy` : undefined} description={total ? `Estimated cost ${money(total)} at average purchase prices` : undefined}>
          <DataTable
            rows={data.shopping}
            rowKey={(r) => r.item.id}
            empty={<Empty icon={<ShoppingCart size={22} />} title="Nothing to buy">Stock covers the next {cover} days at the current pace.</Empty>}
            columns={[
              { key: "n", header: "Item", primary: true, cell: (r) => <span className="font-semibold">{r.item.name}</span> },
              { key: "h", header: "In stock", align: "right", cell: (r) => <span className="num">{formatQty(r.item.stock_qty, r.item.display_unit)}</span> },
              { key: "d", header: "Use per day", align: "right", hideOnCard: true, cell: (r) => <span className="num">{r.perDay ? formatQty(r.perDay, r.item.display_unit) : "—"}</span> },
              { key: "l", header: "Lasts", cell: (r) => (r.reason === "below_min" ? <Badge tone="danger">Below minimum</Badge> : <span className={r.daysLeft !== null && r.daysLeft < 1 ? "font-semibold text-danger" : ""}>{days(r.daysLeft)}</span>) },
              { key: "b", header: "Buy", align: "right", cell: (r) => <b className="num">{formatQty(r.buy, r.item.display_unit)}</b> },
              { key: "c", header: "Approx. cost", align: "right", cell: (r) => <span className="num">{r.estimatedCost === null ? "—" : money(r.estimatedCost)}</span> },
              { key: "s", header: "Supplier", hideOnCard: true, cell: (r) => r.item.supplier ?? "—" },
            ]}
          />
        </Card>
      ) : null}
    </>
  );
}

const STATUS: Record<UsageRow["status"], { label: string; tone: "success" | "warning" | "danger" | "neutral" | "primary" }> = {
  ok: { label: "OK", tone: "success" },
  watch: { label: "Watch", tone: "warning" },
  high: { label: "High loss", tone: "danger" },
  surplus: { label: "More than expected", tone: "primary" },
  not_counted: { label: "Not counted", tone: "neutral" },
};

/** Expected use vs what stock counts found: spots over-portioning, waste that isn't logged, or theft. */
export function UsageCheckTab() {
  const { data, error, loading, reload } = usePlanning(2);
  const rows = data?.usage ?? [];
  const loss = rows.filter((r) => r.gap > 0).reduce((s, r) => s + (r.gapValue ?? 0), 0);
  const flagged = rows.filter((r) => r.status === "high" || r.status === "watch").length;
  return (
    <>
      <p className="mb-3 text-[13.5px] text-muted">
        For {data?.from ?? "…"} to {data?.to ?? "…"}: what recipes, logged use and waste say should have gone, compared with what stock counts found. Up to 5% difference is normal; over 15% needs a look (portion sizes, unlogged waste, or missing stock).
      </p>
      <ErrorBlock error={error} retry={reload} />
      {loading && !data ? (
        <LoadingBlock rows={6} />
      ) : data ? (
        <>
          {flagged > 0 && <Notice tone="warning" className="mb-3">{flagged} items used noticeably more than recorded — about {money(loss)} of stock unaccounted for.</Notice>}
          {rows.some((r) => !r.counted) && <Notice className="mb-3">Items marked “Not counted” need a stock count (Inventory → item → Count stock) to be checked.</Notice>}
          <Card padded={false}>
            <DataTable
              rows={rows}
              rowKey={(r) => r.item.id}
              empty={<Empty title="Nothing to compare yet">Once orders use recipes and you count stock, the comparison appears here.</Empty>}
              columns={[
                { key: "n", header: "Item", primary: true, cell: (r) => <span className="font-semibold">{r.item.name}</span> },
                { key: "e", header: "Expected use", align: "right", cell: (r) => <span className="num">{formatQty(r.expected, r.item.display_unit)}</span> },
                { key: "a", header: "Actual use", align: "right", cell: (r) => <span className="num">{r.counted ? formatQty(r.actual, r.item.display_unit) : "—"}</span> },
                { key: "g", header: "Difference", align: "right", cell: (r) => (r.counted ? <span className="num">{r.gap > 0 ? "+" : ""}{formatQty(r.gap, r.item.display_unit)}{r.gapPct !== null ? ` (${pct(r.gapPct, 0)})` : ""}</span> : "—") },
                { key: "v", header: "Value", align: "right", cell: (r) => <span className="num">{r.counted && r.gapValue !== null ? money(r.gapValue) : "—"}</span> },
                { key: "s", header: "Status", cell: (r) => <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge> },
              ]}
            />
          </Card>
        </>
      ) : null}
    </>
  );
}
