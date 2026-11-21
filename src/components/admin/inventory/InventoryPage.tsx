"use client";

import { ShoppingListTab, UsageCheckTab } from "./PlanningTabs";
import { useEffect, useMemo, useState } from "react";
import { Download, Pencil, Plus, Scale, Trash2 } from "lucide-react";
import { Badge, Button, Card, Checkbox, DataTable, Dialog, Empty, ErrorBlock, Field, Input, LoadingBlock, Notice, PageHeader, Segmented, Select, Stat, Tabs, Textarea, useConfirm, useToast, type Column } from "../ui";
import { useCan } from "../AdminShell";
import { apiFetch, qs, useApi, type ClientApiError } from "@/lib/api-client";
import { addDays, dateOf, dateTime, istDate, money, pct } from "@/lib/format";
import { UNITS, baseOf, factorOf, formatQty, formatUnitCost, fromBase, isUnit, toBase, unitsFor, type Unit } from "@/lib/units";
import { clsx } from "@/lib/clsx";

export interface InvItem {
  id: string;
  name: string;
  sku: string | null;
  category_id: string | null;
  category: string | null;
  base_unit: string;
  display_unit: string;
  stock_qty: number;
  min_qty: number;
  avg_cost: number | null;
  track_expiry: boolean;
  is_sellable: boolean;
  sell_unit_name: string;
  sell_unit_qty: number | null;
  retail_price: number | null;
  wholesale_price: number | null;
  default_supplier_id: string | null;
  supplier: string | null;
  is_active: boolean;
  next_expiry: string | null;
  expiring_qty: number | null;
  used_in: number;
  last_purchase_cost: number | null;
  value: number | null;
  low: boolean;
  out: boolean;
  sell_unit_cost: number | null;
  retail_margin: number | null;
  wholesale_margin: number | null;
}
interface InvData {
  items: InvItem[];
  categories: { id: string; name: string; items: number }[];
  suppliers: { id: string; name: string }[];
  summary: { count: number; value: number; unvalued: number; low: number; out: number; expiring: number };
}

const u = (x: string): Unit => (isUnit(x) ? x : "pcs");

export function InventoryPage() {
  const [tab, setTab] = useState<"items" | "shopping" | "usage" | "movements" | "categories">("items");
  const { data, error, loading, reload } = useApi<InvData>("/api/admin/inventory");
  const can = useCan();
  const [edit, setEdit] = useState<InvItem | "new" | null>(null);
  const [adjust, setAdjust] = useState<InvItem | null>(null);
  const [view, setView] = useState<string | null>(null);

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Ingredients and packaged goods. Stock goes down automatically as orders are confirmed, using each dish's recipe."
        actions={
          <>
            <a href="/api/admin/reports/inventory?format=csv" download>
              <Button variant="secondary" icon={<Download size={15} />}>
                Stock report
              </Button>
            </a>
            {can("inventory.manage") && (
              <Button icon={<Plus size={16} />} onClick={() => setEdit("new")}>
                Add item
              </Button>
            )}
          </>
        }
      />
      <ErrorBlock error={error} retry={reload} />
      {data && (
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Stock value" value={money(data.summary.value)} sub={data.summary.unvalued ? `${data.summary.unvalued} item(s) have no cost yet` : `${data.summary.count} items at average cost`} />
          <Stat label="Running low" value={data.summary.low} tone={data.summary.low ? "warning" : "default"} sub="At or below minimum" />
          <Stat label="Out of stock" value={data.summary.out} tone={data.summary.out ? "danger" : "default"} />
          <Stat label="Expiring in 7 days" value={data.summary.expiring} tone={data.summary.expiring ? "warning" : "default"} />
        </div>
      )}
      <Tabs
        value={tab}
        onChange={setTab}
        className="mb-4"
        items={[
          { value: "items", label: "Stock" },
          { value: "shopping", label: "Shopping list" },
          { value: "usage", label: "Usage check" },
          { value: "movements", label: "Stock movements" },
          { value: "categories", label: "Categories" },
        ]}
      />
      {tab === "items" && (loading ? <LoadingBlock rows={8} /> : data && <ItemsTab data={data} onEdit={setEdit} onAdjust={setAdjust} onView={setView} />)}
      {tab === "shopping" && <ShoppingListTab />}
      {tab === "usage" && <UsageCheckTab />}
      {tab === "movements" && data && <MovementsTab items={data.items} />}
      {tab === "categories" && data && <CategoriesTab categories={data.categories} reload={reload} />}

      {edit && data && <ItemEditor item={edit === "new" ? null : edit} data={data} onClose={() => setEdit(null)} onSaved={reload} />}
      {adjust && <AdjustDialog item={adjust} onClose={() => setAdjust(null)} onDone={() => { reload(); window.dispatchEvent(new Event("inventory:changed")); }} />}
      {view && data && (
        <ItemDrawer
          id={view}
          onClose={() => setView(null)}
          onEdit={(i) => { setView(null); setEdit(i); }}
          onAdjust={(i) => setAdjust(i)}
          onArchived={() => { setView(null); reload(); }}
        />
      )}
    </>
  );
}

function ItemsTab({ data, onEdit, onAdjust, onView }: { data: InvData; onEdit: (i: InvItem) => void; onAdjust: (i: InvItem) => void; onView: (id: string) => void }) {
  const can = useCan();
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("");
  const [status, setStatus] = useState<"all" | "low" | "expiring" | "sellable">("all");
  const rows = useMemo(() => {
    const s = query.trim().toLowerCase();
    return data.items.filter(
      (i) =>
        (!s || i.name.toLowerCase().includes(s) || (i.sku ?? "").toLowerCase().includes(s)) &&
        (!cat || (cat === "none" ? !i.category_id : i.category_id === cat)) &&
        (status === "all" || (status === "low" ? i.low || i.out : status === "expiring" ? (i.expiring_qty ?? 0) > 0 : i.is_sellable)),
    );
  }, [data.items, query, cat, status]);

  if (!data.items.length)
    return (
      <Empty title="No inventory items yet">
        Add the ingredients and packaged goods you buy — milk, coffee beans, oats, cups. Then link them to dishes in each dish&apos;s recipe, and stock will update itself as orders come in.
      </Empty>
    );

  const columns: Column<InvItem>[] = [
    {
      key: "name",
      header: "Item",
      primary: true,
      cell: (i) => (
        <div className="min-w-0">
          <p className="font-semibold">
            {i.name} {i.is_sellable && <Badge tone="primary">For sale</Badge>}
          </p>
          <p className="text-[12.5px] text-muted">
            {i.category ?? "Uncategorised"}
            {i.used_in > 0 && ` · in ${i.used_in} recipe${i.used_in === 1 ? "" : "s"}`}
          </p>
        </div>
      ),
    },
    {
      key: "stock",
      header: "In stock",
      align: "right",
      cell: (i) => (
        <span className="inline-flex items-center justify-end gap-1.5">
          {i.out ? <Badge tone="danger">Out</Badge> : i.low ? <Badge tone="warning">Low</Badge> : null}
          <span className={clsx("num font-semibold", i.out && "text-danger")}>{formatQty(Number(i.stock_qty), i.display_unit)}</span>
        </span>
      ),
    },
    { key: "min", header: "Minimum", align: "right", hideOnCard: true, cell: (i) => <span className="num text-muted">{Number(i.min_qty) ? formatQty(Number(i.min_qty), i.display_unit) : "—"}</span> },
    { key: "cost", header: "Avg cost", align: "right", cell: (i) => <span className="num">{formatUnitCost(i.avg_cost === null ? null : Number(i.avg_cost), i.display_unit) ?? <span className="text-muted">Not set</span>}</span> },
    { key: "value", header: "Value", align: "right", cell: (i) => <span className="num">{i.value === null ? "—" : money(i.value)}</span> },
    {
      key: "expiry",
      header: "Next expiry",
      hideOnCard: true,
      cell: (i) => (i.next_expiry ? <span className={clsx((i.expiring_qty ?? 0) > 0 && "font-semibold text-warning")}>{dateOf(i.next_expiry)}</span> : <span className="text-muted">—</span>),
    },
    {
      key: "act",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      hideOnCard: true,
      cell: (i) =>
        can("inventory.manage") && (
          <span className="inline-flex gap-1" onClick={(e) => e.stopPropagation()}>
            <Button size="sm" variant="secondary" icon={<Scale size={14} />} onClick={() => onAdjust(i)}>
              Adjust
            </Button>
            <Button size="sm" variant="ghost" aria-label={`Edit ${i.name}`} icon={<Pencil size={14} />} onClick={() => onEdit(i)} />
          </span>
        ),
    },
  ];

  return (
    <Card padded={false}>
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
        <div className="min-w-[180px] flex-1">
          <Input aria-label="Search inventory" placeholder="Search by name or SKU" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Select aria-label="Category" value={cat} onChange={(e) => setCat(e.target.value)} className="w-auto">
          <option value="">All categories</option>
          {data.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value="none">Uncategorised</option>
        </Select>
        <Segmented
          label="Show"
          value={status}
          onChange={setStatus}
          items={[
            { value: "all", label: "All" },
            { value: "low", label: `Low (${data.summary.low + data.summary.out})` },
            { value: "expiring", label: "Expiring" },
            { value: "sellable", label: "For sale" },
          ]}
        />
      </div>
      <DataTable rows={rows} columns={columns} rowKey={(i) => i.id} onRowClick={(i) => onView(i.id)} empty={<p className="p-8 text-center text-muted">No items match these filters.</p>} />
    </Card>
  );
}

/* ── Editor ─────────────────────────────────────────────────────────────── */

function ItemEditor({ item, data, onClose, onSaved }: { item: InvItem | null; data: InvData; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const unit0 = u(item?.display_unit ?? "kg");
  const [f, setF] = useState({
    name: item?.name ?? "",
    sku: item?.sku ?? "",
    category_id: item?.category_id ?? "",
    display_unit: unit0,
    min: item ? String(fromBase(Number(item.min_qty), unit0) || "") : "",
    track_expiry: item?.track_expiry ?? false,
    default_supplier_id: item?.default_supplier_id ?? "",
    is_sellable: item?.is_sellable ?? false,
    sell_unit_name: item?.sell_unit_name ?? "",
    sell_qty: item?.sell_unit_qty ? String(fromBase(Number(item.sell_unit_qty), unit0)) : "",
    retail_price: item?.retail_price != null ? String(item.retail_price) : "",
    wholesale_price: item?.wholesale_price != null ? String(item.wholesale_price) : "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<ClientApiError | null>(null);
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const unitChoices = item ? unitsFor(baseOf(unit0)) : UNITS;
  const n = (s: string) => (s.trim() === "" ? null : Number(s));

  const sellQtyBase = n(f.sell_qty) ? toBase(Number(f.sell_qty), f.display_unit) : null;
  const unitCost = item?.avg_cost != null && sellQtyBase ? Number(item.avg_cost) * sellQtyBase : null;
  const margin = (price: number | null) => (price && unitCost !== null ? (price - unitCost) / price : null);

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      const body = {
        name: f.name,
        sku: f.sku,
        category_id: f.category_id || null,
        display_unit: f.display_unit,
        min_qty: n(f.min) ? toBase(Number(f.min), f.display_unit) : 0,
        track_expiry: f.track_expiry,
        default_supplier_id: f.default_supplier_id || null,
        is_sellable: f.is_sellable,
        sell_unit_name: f.sell_unit_name,
        sell_unit_qty: sellQtyBase,
        retail_price: n(f.retail_price),
        wholesale_price: n(f.wholesale_price),
      };
      if (item) await apiFetch(`/api/admin/inventory/${item.id}`, { method: "PATCH", body });
      else await apiFetch("/api/admin/inventory", { body });
      toast(item ? "Item updated" : "Item added — record its opening stock with Adjust");
      onSaved();
      onClose();
    } catch (e) {
      setErr(e as ClientApiError);
    } finally {
      setBusy(false);
    }
  };
  const fe = err?.fields ?? {};

  return (
    <Dialog
      open
      side
      onClose={onClose}
      title={item ? `Edit ${item.name}` : "Add inventory item"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy}>
            Save
          </Button>
        </>
      }
    >
      {err && !err.fields && <Notice tone="danger" className="mb-3">{err.message}</Notice>}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name" htmlFor="inv-name" error={fe.name} className="col-span-2">
          <Input id="inv-name" value={f.name} maxLength={80} onChange={(e) => set({ name: e.target.value })} invalid={!!fe.name} />
        </Field>
        <Field label="Category" htmlFor="inv-cat">
          <Select id="inv-cat" value={f.category_id} onChange={(e) => set({ category_id: e.target.value })}>
            <option value="">Uncategorised</option>
            {data.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="SKU / code" htmlFor="inv-sku" optional error={fe.sku}>
          <Input id="inv-sku" value={f.sku} maxLength={40} onChange={(e) => set({ sku: e.target.value })} />
        </Field>
        <Field label="Measured in" htmlFor="inv-unit" error={fe.display_unit} hint={item ? "Can change between units of the same kind" : "How you buy and count it"}>
          <Select id="inv-unit" value={f.display_unit} onChange={(e) => set({ display_unit: e.target.value as Unit })}>
            {unitChoices.map((x) => (
              <option key={x.value} value={x.value}>
                {x.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Minimum level" htmlFor="inv-min" optional hint="Alert when stock falls to this">
          <Input id="inv-min" inputMode="decimal" suffix={f.display_unit} value={f.min} onChange={(e) => set({ min: e.target.value.replace(/[^\d.]/g, "") })} />
        </Field>
        <Field label="Usual supplier" htmlFor="inv-sup" optional className="col-span-2">
          <Select id="inv-sup" value={f.default_supplier_id} onChange={(e) => set({ default_supplier_id: e.target.value })}>
            <option value="">None</option>
            {data.suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="mt-4 space-y-3">
        <Checkbox label="Track expiry dates" hint="Ask for the expiry date when stock arrives and warn before it expires." checked={f.track_expiry} onChange={(v) => set({ track_expiry: v })} />
        <Checkbox label="Sell this item directly" hint="Sold over the counter as a packaged product, at retail or wholesale prices." checked={f.is_sellable} onChange={(v) => set({ is_sellable: v })} />
      </div>
      {f.is_sellable && (
        <fieldset className="mt-4 rounded-xl border border-line p-3">
          <legend className="px-1 text-[13px] font-semibold">Selling</legend>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Sold as" htmlFor="inv-su" error={fe.sell_unit_name}>
              <Input id="inv-su" placeholder="500 g pack" value={f.sell_unit_name} maxLength={30} onChange={(e) => set({ sell_unit_name: e.target.value })} invalid={!!fe.sell_unit_name} />
            </Field>
            <Field label="Each one uses" htmlFor="inv-sq" error={fe.sell_unit_qty}>
              <Input id="inv-sq" inputMode="decimal" suffix={f.display_unit} value={f.sell_qty} onChange={(e) => set({ sell_qty: e.target.value.replace(/[^\d.]/g, "") })} invalid={!!fe.sell_unit_qty} />
            </Field>
            <Field label="Retail price" htmlFor="inv-rp" error={fe.retail_price} hint={margin(n(f.retail_price)) !== null ? `Margin ${pct(margin(n(f.retail_price)))}` : undefined}>
              <Input id="inv-rp" prefix="₹" inputMode="decimal" value={f.retail_price} onChange={(e) => set({ retail_price: e.target.value.replace(/[^\d.]/g, "") })} />
            </Field>
            <Field label="Wholesale price" htmlFor="inv-wp" optional hint={margin(n(f.wholesale_price)) !== null ? `Margin ${pct(margin(n(f.wholesale_price)))}` : undefined}>
              <Input id="inv-wp" prefix="₹" inputMode="decimal" value={f.wholesale_price} onChange={(e) => set({ wholesale_price: e.target.value.replace(/[^\d.]/g, "") })} />
            </Field>
          </div>
          <p className="mt-2 text-[12.5px] text-muted">
            {unitCost !== null ? (
              <>
                Each costs you <b className="num text-fg">{money(unitCost)}</b> at today&apos;s average cost.
              </>
            ) : (
              "Margins show once this item has a cost (from a purchase or opening stock)."
            )}
          </p>
        </fieldset>
      )}
    </Dialog>
  );
}

/* ── Stock adjustment ───────────────────────────────────────────────────── */

const REASONS = {
  wastage: ["Spoiled", "Expired", "Spilled or dropped", "Made wrongly", "Staff meal", "Other"],
  adjustment: ["Entry mistake", "Found extra stock", "Missing stock", "Other"],
};

export function AdjustDialog({ item, onClose, onDone }: { item: InvItem; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const base = u(item.display_unit);
  const [kind, setKind] = useState<"count" | "wastage" | "adjustment" | "opening">(Number(item.stock_qty) === 0 && item.avg_cost === null ? "opening" : "count");
  const [unit, setUnit] = useState<Unit>(base);
  const [qty, setQty] = useState("");
  const [sign, setSign] = useState<1 | -1>(-1);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [cost, setCost] = useState("");
  const [expiry, setExpiry] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<ClientApiError | null>(null);

  const q = Number(qty);
  const valid = qty.trim() !== "" && Number.isFinite(q) && q >= 0 && (kind === "count" || q > 0);
  const baseQty = valid ? toBase(q, unit) : 0;
  const current = Number(item.stock_qty);
  const after = kind === "count" ? baseQty : kind === "wastage" ? current - baseQty : kind === "opening" ? current + baseQty : current + sign * baseQty;

  const go = async () => {
    setBusy(true);
    setErr(null);
    try {
      await apiFetch(`/api/admin/inventory/${item.id}/adjust`, {
        body: {
          kind,
          qty: kind === "adjustment" ? sign * baseQty : baseQty,
          unit_cost: kind === "opening" && cost ? Number(cost) / factorOf(unit) : null,
          reason,
          note,
          expiry_date: expiry || null,
        },
      });
      toast(`${item.name}: stock now ${formatQty(after, item.display_unit)}`);
      onDone();
      onClose();
    } catch (e) {
      setErr(e as ClientApiError);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      size="sm"
      onClose={onClose}
      title={`Adjust ${item.name}`}
      description={`In stock now: ${formatQty(current, item.display_unit)}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={go} loading={busy} disabled={!valid || ((kind === "wastage" || kind === "adjustment") && !reason)}>
            Save
          </Button>
        </>
      }
    >
      {err && <Notice tone="danger" className="mb-3">{err.message}</Notice>}
      <div className="mb-4">
        <Segmented
          label="Type of change"
          value={kind}
          onChange={(k) => { setKind(k); setReason(""); }}
          items={[
            { value: "count", label: "Count" },
            { value: "wastage", label: "Wastage" },
            { value: "adjustment", label: "Correct" },
            { value: "opening", label: "Add stock" },
          ]}
        />
        <p className="mt-2 text-[12.5px] text-muted">
          {kind === "count" && "Enter what you physically counted. The difference is recorded."}
          {kind === "wastage" && "Stock thrown away. Its cost shows as wastage in the P&L."}
          {kind === "adjustment" && "Fix a mistake by adding or removing an amount."}
          {kind === "opening" && "Stock you already had, without a purchase bill. For new deliveries, record a purchase instead."}
        </p>
      </div>
      {kind === "adjustment" && (
        <div className="mb-3">
          <Segmented label="Direction" value={sign === 1 ? "add" : "remove"} onChange={(v) => setSign(v === "add" ? 1 : -1)} items={[{ value: "remove", label: "Remove" }, { value: "add", label: "Add" }]} />
        </div>
      )}
      <div className="grid grid-cols-[1fr_120px] gap-2">
        <Field label={kind === "count" ? "Counted quantity" : "Quantity"} htmlFor="adj-qty" error={err?.fields?.qty}>
          <Input id="adj-qty" inputMode="decimal" autoFocus value={qty} onChange={(e) => setQty(e.target.value.replace(/[^\d.]/g, ""))} />
        </Field>
        <Field label="Unit" htmlFor="adj-unit">
          <Select id="adj-unit" value={unit} onChange={(e) => setUnit(e.target.value as Unit)}>
            {unitsFor(baseOf(base)).map((x) => (
              <option key={x.value} value={x.value}>
                {x.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {(kind === "wastage" || kind === "adjustment") && (
        <Field label="Reason" htmlFor="adj-reason" className="mt-3" error={err?.fields?.reason}>
          <Select id="adj-reason" value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="">Choose…</option>
            {REASONS[kind].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </Select>
        </Field>
      )}
      {kind === "opening" && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Field label={`Cost per ${unit}`} htmlFor="adj-cost" optional hint={item.avg_cost === null ? "Needed for stock value and profit" : undefined}>
            <Input id="adj-cost" prefix="₹" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value.replace(/[^\d.]/g, ""))} />
          </Field>
          {item.track_expiry && (
            <Field label="Expiry date" htmlFor="adj-exp" error={err?.fields?.expiry_date}>
              <Input id="adj-exp" type="date" value={expiry} min={istDate()} onChange={(e) => setExpiry(e.target.value)} />
            </Field>
          )}
        </div>
      )}
      <Field label="Note" htmlFor="adj-note" optional className="mt-3">
        <Textarea id="adj-note" rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      {valid && (
        <p className={clsx("mt-3 rounded-lg bg-surface-2 px-3 py-2 text-[13.5px]", after < 0 && "text-danger")}>
          Stock after: <b className="num">{formatQty(after, item.display_unit)}</b>
          {kind === "count" && ` (${after - current >= 0 ? "+" : ""}${formatQty(after - current, item.display_unit)})`}
        </p>
      )}
    </Dialog>
  );
}

/* ── Item detail ────────────────────────────────────────────────────────── */

const KIND_LABEL: Record<string, string> = {
  opening: "Opening stock",
  purchase: "Purchase",
  sale: "Used in order",
  sale_return: "Order cancelled",
  wastage: "Wastage",
  adjustment: "Correction",
  count: "Stock count",
  purchase_cancel: "Purchase cancelled",
};

interface Movement {
  id: number;
  kind: string;
  qty: number;
  value: number | null;
  reason: string;
  note: string;
  created_at: string;
  order_number: number | null;
  purchase_number: number | null;
  user_name: string | null;
  item?: string;
  display_unit?: string;
}

function ItemDrawer({ id, onClose, onEdit, onAdjust, onArchived }: { id: string; onClose: () => void; onEdit: (i: InvItem) => void; onAdjust: (i: InvItem) => void; onArchived: () => void }) {
  const { data, error, loading, reload } = useApi<{ item: InvItem; batches: { id: string; qty_remaining: number; unit_cost: number | null; expiry_date: string | null; received_at: string }[]; movements: Movement[]; used_in: { name: string; qty: number; kind: string }[] }>(`/api/admin/inventory/${id}`);
  const can = useCan();
  const toast = useToast();
  const { ask, node } = useConfirm();
  // reflect adjustments made from this drawer
  useEffect(() => {
    const h = () => reload();
    window.addEventListener("inventory:changed", h);
    return () => window.removeEventListener("inventory:changed", h);
  }, [reload]);
  const i = data?.item;

  const archive = async () => {
    if (!i) return;
    const r = await ask({ title: `Archive ${i.name}?`, body: "It disappears from inventory and can't be used in recipes. Its history stays in reports.", confirm: "Archive", danger: true });
    if (!r.ok) return;
    try {
      await apiFetch(`/api/admin/inventory/${i.id}`, { method: "DELETE" });
      toast(`${i.name} archived`);
      onArchived();
    } catch (e) {
      toast((e as ClientApiError).message, "error");
    }
  };

  return (
    <Dialog
      open
      side
      size="lg"
      onClose={onClose}
      title={i?.name ?? "Item"}
      description={i ? `${i.category ?? "Uncategorised"}${i.supplier ? ` · from ${i.supplier}` : ""}` : undefined}
      footer={
        i &&
        can("inventory.manage") && (
          <>
            <Button variant="ghost" className="mr-auto text-danger" icon={<Trash2 size={14} />} onClick={archive}>
              Archive
            </Button>
            <Button variant="secondary" icon={<Pencil size={14} />} onClick={() => onEdit(i)}>
              Edit
            </Button>
            <Button icon={<Scale size={14} />} onClick={() => onAdjust(i)}>
              Adjust stock
            </Button>
          </>
        )
      }
    >
      {node}
      <ErrorBlock error={error} retry={reload} />
      {loading || !data || !i ? (
        <LoadingBlock rows={5} />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Mini label="In stock" value={formatQty(Number(i.stock_qty), i.display_unit)} tone={i.out ? "danger" : i.low ? "warning" : undefined} />
            <Mini label="Average cost" value={formatUnitCost(i.avg_cost === null ? null : Number(i.avg_cost), i.display_unit) ?? "Not set"} />
            <Mini label="Value" value={i.value === null ? "—" : money(i.value)} />
            {i.last_purchase_cost !== null && <Mini label="Last bought at" value={formatUnitCost(Number(i.last_purchase_cost), i.display_unit)!} />}
            {Number(i.min_qty) > 0 && <Mini label="Minimum" value={formatQty(Number(i.min_qty), i.display_unit)} />}
            {i.is_sellable && (
              <Mini
                label={`Price per ${i.sell_unit_name}`}
                value={[i.retail_price !== null && `${money(i.retail_price)} retail`, i.wholesale_price !== null && `${money(i.wholesale_price)} wholesale`].filter(Boolean).join(" · ")}
                sub={i.sell_unit_cost !== null ? `Cost ${money(i.sell_unit_cost)} · margin ${pct(i.retail_margin)}${i.wholesale_margin !== null ? ` / ${pct(i.wholesale_margin)}` : ""}` : undefined}
              />
            )}
          </div>

          {data.used_in.length > 0 && (
            <section>
              <h3 className="eyebrow mb-2">Used in</h3>
              <ul className="flex flex-wrap gap-1.5">
                {data.used_in.map((x) => (
                  <li key={x.name} className="rounded-full border border-line px-2.5 py-1 text-[12.5px]">
                    {x.name} · <span className="num text-muted">{formatQty(Number(x.qty), i.display_unit)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {data.batches.length > 0 && i.track_expiry && (
            <section>
              <h3 className="eyebrow mb-2">Batches</h3>
              <ul className="divide-y divide-line rounded-lg border border-line text-[13.5px]">
                {data.batches.map((b) => {
                  const soon = b.expiry_date && b.expiry_date <= addDays(istDate(), 7);
                  return (
                    <li key={b.id} className="flex justify-between px-3 py-2">
                      <span className="num">{formatQty(Number(b.qty_remaining), i.display_unit)}</span>
                      <span className={clsx(soon && "font-semibold text-warning")}>{b.expiry_date ? `Expires ${dateOf(b.expiry_date)}` : "No expiry date"}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section>
            <h3 className="eyebrow mb-2">History</h3>
            {!data.movements.length ? (
              <p className="text-[13.5px] text-muted">No stock changes yet.</p>
            ) : (
              <ul className="divide-y divide-line rounded-lg border border-line text-[13.5px]">
                {data.movements.map((m) => (
                  <li key={m.id} className="flex items-start justify-between gap-3 px-3 py-2">
                    <div className="min-w-0">
                      <p className="font-semibold">
                        {KIND_LABEL[m.kind] ?? m.kind}
                        {m.order_number && <span className="font-normal text-muted"> · order #{m.order_number}</span>}
                        {m.purchase_number && <span className="font-normal text-muted"> · purchase #{m.purchase_number}</span>}
                      </p>
                      <p className="text-[12.5px] text-muted">
                        {dateTime(m.created_at)}
                        {m.user_name && ` · ${m.user_name}`}
                        {m.reason && !m.order_number && !m.purchase_number && ` · ${m.reason}`}
                        {m.note && ` · ${m.note}`}
                      </p>
                    </div>
                    <span className={clsx("num shrink-0 font-semibold", Number(m.qty) < 0 ? "text-danger" : "text-success")}>
                      {Number(m.qty) > 0 && "+"}
                      {formatQty(Number(m.qty), i.display_unit)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </Dialog>
  );
}

function Mini({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "danger" | "warning" }) {
  return (
    <div className="rounded-lg border border-line px-3 py-2">
      <p className="text-[12px] text-muted">{label}</p>
      <p className={clsx("num text-[15px] font-semibold", tone === "danger" && "text-danger", tone === "warning" && "text-warning")}>{value}</p>
      {sub && <p className="text-[12px] text-muted">{sub}</p>}
    </div>
  );
}

/* ── Movements ──────────────────────────────────────────────────────────── */

function MovementsTab({ items }: { items: InvItem[] }) {
  const [from, setFrom] = useState(addDays(istDate(), -6));
  const [to, setTo] = useState(istDate());
  const [kind, setKind] = useState("");
  const [item, setItem] = useState("");
  const params = { from, to, kind: kind || undefined, item: item || undefined };
  const { data, error, loading, reload } = useApi<{ movements: (Movement & { item: string; display_unit: string })[] }>(`/api/admin/inventory/movements${qs(params)}`);
  return (
    <Card padded={false}>
      <div className="flex flex-wrap items-end gap-2 border-b border-line p-3">
        <Field label="From" htmlFor="mv-from">
          <Input id="mv-from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="To" htmlFor="mv-to">
          <Input id="mv-to" type="date" value={to} min={from} max={istDate()} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <Field label="Type" htmlFor="mv-kind">
          <Select id="mv-kind" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="">All changes</option>
            {Object.entries(KIND_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Item" htmlFor="mv-item">
          <Select id="mv-item" value={item} onChange={(e) => setItem(e.target.value)}>
            <option value="">All items</option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </Select>
        </Field>
        <a href={`/api/admin/inventory/movements${qs({ ...params, format: "csv" })}`} className="ml-auto">
          <Button variant="secondary" icon={<Download size={15} />}>
            CSV
          </Button>
        </a>
      </div>
      <ErrorBlock error={error} retry={reload} />
      {loading ? (
        <div className="p-4">
          <LoadingBlock rows={6} />
        </div>
      ) : (
        <DataTable
          dense
          rows={data?.movements ?? []}
          rowKey={(m) => String(m.id)}
          empty={<p className="p-8 text-center text-muted">No stock changes in this period.</p>}
          columns={[
            { key: "when", header: "When", cell: (m) => <span className="whitespace-nowrap">{dateTime(m.created_at)}</span> },
            { key: "item", header: "Item", primary: true, cell: (m) => <span className="font-semibold">{m.item}</span> },
            { key: "kind", header: "Change", cell: (m) => KIND_LABEL[m.kind] ?? m.kind },
            {
              key: "qty",
              header: "Quantity",
              align: "right",
              cell: (m) => (
                <span className={clsx("num font-semibold", Number(m.qty) < 0 ? "text-danger" : "text-success")}>
                  {Number(m.qty) > 0 && "+"}
                  {formatQty(Number(m.qty), m.display_unit)}
                </span>
              ),
            },
            { key: "value", header: "Value", align: "right", cell: (m) => <span className="num">{m.value === null ? "—" : money(Number(m.value))}</span> },
            { key: "ref", header: "Reference", cell: (m) => (m.order_number ? `Order #${m.order_number}` : m.purchase_number ? `Purchase #${m.purchase_number}` : [m.reason, m.note].filter(Boolean).join(" · ") || "—") },
            { key: "by", header: "By", hideOnCard: true, cell: (m) => m.user_name ?? <span className="text-muted">System</span> },
          ]}
        />
      )}
    </Card>
  );
}

/* ── Categories ─────────────────────────────────────────────────────────── */

function CategoriesTab({ categories, reload }: { categories: InvData["categories"]; reload: () => void }) {
  const can = useCan();
  const toast = useToast();
  const { ask, node } = useConfirm();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const add = async () => {
    setBusy(true);
    try {
      await apiFetch("/api/admin/inventory/categories", { body: { name } });
      setName("");
      reload();
    } catch (e) {
      toast((e as ClientApiError).message, "error");
    } finally {
      setBusy(false);
    }
  };
  const rename = async (c: InvData["categories"][number]) => {
    const r = await ask({ title: "Rename category", reason: { label: "Name", value: c.name, required: true, single: true }, confirm: "Save" });
    if (!r.ok || !r.reason) return;
    try {
      await apiFetch(`/api/admin/inventory/categories/${c.id}`, { method: "PATCH", body: { name: r.reason } });
      reload();
    } catch (e) {
      toast((e as ClientApiError).message, "error");
    }
  };
  const remove = async (c: InvData["categories"][number]) => {
    const r = await ask({ title: `Delete ${c.name}?`, body: c.items ? `Its ${c.items} item(s) become uncategorised.` : undefined, confirm: "Delete", danger: true });
    if (!r.ok) return;
    try {
      await apiFetch(`/api/admin/inventory/categories/${c.id}`, { method: "DELETE" });
      reload();
    } catch (e) {
      toast((e as ClientApiError).message, "error");
    }
  };
  return (
    <Card padded={false} className="max-w-xl">
      {node}
      <ul className="divide-y divide-line">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
            <span>
              <span className="font-semibold">{c.name}</span> <span className="text-[13px] text-muted">· {c.items} item{c.items === 1 ? "" : "s"}</span>
            </span>
            {can("inventory.manage") && (
              <span className="flex gap-1">
                <Button size="sm" variant="ghost" aria-label={`Rename ${c.name}`} icon={<Pencil size={14} />} onClick={() => rename(c)} />
                <Button size="sm" variant="ghost" aria-label={`Delete ${c.name}`} icon={<Trash2 size={14} />} onClick={() => remove(c)} />
              </span>
            )}
          </li>
        ))}
      </ul>
      {can("inventory.manage") && (
        <form
          className="flex gap-2 border-t border-line p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim().length >= 2) add();
          }}
        >
          <Input aria-label="New category" placeholder="New category" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
          <Button type="submit" loading={busy} disabled={name.trim().length < 2}>
            Add
          </Button>
        </form>
      )}
    </Card>
  );
}
