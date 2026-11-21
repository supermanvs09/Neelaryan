"use client";

import { useMemo, useState } from "react";
import { Download, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge, Button, Card, Checkbox, DataTable, Dialog, Empty, ErrorBlock, Field, Input, LoadingBlock, Notice, PageHeader, Select, Stat, Tabs, Textarea, useConfirm, useToast } from "../ui";
import { useCan } from "../AdminShell";
import { apiFetch, qs, useApi, type ClientApiError } from "@/lib/api-client";
import { addDays, dateOf, istDate, money } from "@/lib/format";
import { baseOf, formatQty, formatUnitCost, isUnit, toBase, unitsFor, type Unit } from "@/lib/units";
import type { InvItem } from "./InventoryPage";

interface PurchaseRow {
  id: string;
  number: number;
  purchased_on: string;
  supplier: string | null;
  invoice_no: string;
  status: "received" | "cancelled";
  subtotal: number;
  tax: number;
  total: number;
  amount_paid: number;
  payment_status: "paid" | "partial" | "unpaid";
  lines: number;
}
interface SupplierRow {
  id: string;
  name: string;
  contact_name: string;
  phone: string;
  email: string;
  gstin: string;
  address: string;
  notes: string;
  is_active: boolean;
  purchased: number;
  outstanding: number;
  purchases: number;
  last_purchase: string | null;
}

const PAY_TONE = { paid: "success", partial: "warning", unpaid: "danger" } as const;
const PAY_LABEL = { paid: "Paid", partial: "Part paid", unpaid: "Unpaid" } as const;

export function PurchasesPage() {
  const [tab, setTab] = useState<"purchases" | "suppliers">("purchases");
  const [creating, setCreating] = useState(false);
  const [refresh, setRefresh] = useState(0);
  return (
    <>
      <PageHeader
        title="Purchases & suppliers"
        description="Record what you buy. Stock goes up and each item's average cost updates, so profit stays accurate."
        actions={
          <Button icon={<Plus size={16} />} onClick={() => setCreating(true)}>
            Record purchase
          </Button>
        }
      />
      <Tabs
        className="mb-4"
        value={tab}
        onChange={setTab}
        items={[
          { value: "purchases", label: "Purchases" },
          { value: "suppliers", label: "Suppliers" },
        ]}
      />
      {tab === "purchases" ? <PurchasesTab key={refresh} /> : <SuppliersTab />}
      {creating && <PurchaseForm onClose={() => setCreating(false)} onSaved={() => setRefresh((n) => n + 1)} />}
    </>
  );
}

function PurchasesTab() {
  const [from, setFrom] = useState(addDays(istDate(), -29));
  const [to, setTo] = useState(istDate());
  const [payment, setPayment] = useState("");
  const params = { from, to, payment: payment || undefined };
  const { data, error, loading, reload } = useApi<{ purchases: PurchaseRow[] }>(`/api/admin/purchases${qs(params)}`);
  const [open, setOpen] = useState<string | null>(null);
  const rows = data?.purchases ?? [];
  const live = rows.filter((r) => r.status === "received");
  const total = live.reduce((s, r) => s + Number(r.total), 0);
  const due = live.reduce((s, r) => s + Number(r.total) - Number(r.amount_paid), 0);

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="Purchased in period" value={money(total)} sub={`${live.length} purchase${live.length === 1 ? "" : "s"}`} />
        <Stat label="Still to pay suppliers" value={money(due)} tone={due > 0 ? "warning" : "default"} />
      </div>
      <Card padded={false}>
        <div className="flex flex-wrap items-end gap-2 border-b border-line p-3">
          <Field label="From" htmlFor="pu-from">
            <Input id="pu-from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="To" htmlFor="pu-to">
            <Input id="pu-to" type="date" value={to} min={from} max={istDate()} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <Field label="Payment" htmlFor="pu-pay">
            <Select id="pu-pay" value={payment} onChange={(e) => setPayment(e.target.value)}>
              <option value="">Any</option>
              <option value="unpaid">Unpaid</option>
              <option value="partial">Part paid</option>
              <option value="paid">Paid</option>
            </Select>
          </Field>
          <a href={`/api/admin/purchases${qs({ ...params, format: "csv" })}`} className="ml-auto">
            <Button variant="secondary" icon={<Download size={15} />}>
              CSV
            </Button>
          </a>
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
            onRowClick={(r) => setOpen(r.id)}
            empty={<Empty title="No purchases in this period">Record a purchase whenever stock arrives.</Empty>}
            columns={[
              { key: "n", header: "Purchase", primary: true, cell: (r) => <span className="font-semibold">#{r.number} {r.supplier && <span className="font-normal text-muted">· {r.supplier}</span>}</span> },
              { key: "d", header: "Date", cell: (r) => dateOf(r.purchased_on) },
              { key: "inv", header: "Invoice", hideOnCard: true, cell: (r) => r.invoice_no || <span className="text-muted">—</span> },
              { key: "items", header: "Items", align: "right", hideOnCard: true, cell: (r) => <span className="num">{r.lines}</span> },
              { key: "t", header: "Total", align: "right", cell: (r) => <span className={r.status === "cancelled" ? "num text-muted line-through" : "num font-semibold"}>{money(Number(r.total))}</span> },
              { key: "p", header: "Payment", cell: (r) => (r.status === "cancelled" ? <Badge>Cancelled</Badge> : <Badge tone={PAY_TONE[r.payment_status]}>{PAY_LABEL[r.payment_status]}</Badge>) },
            ]}
          />
        )}
      </Card>
      {open && <PurchaseDrawer id={open} onClose={() => setOpen(null)} onChanged={reload} />}
    </>
  );
}

/* ── New purchase ───────────────────────────────────────────────────────── */

interface Line {
  key: number;
  item_id: string;
  qty: string;
  unit: Unit;
  amount: string;
  expiry: string;
}

function PurchaseForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { data } = useApi<{ items: InvItem[]; suppliers: { id: string; name: string }[] }>("/api/admin/inventory");
  const toast = useToast();
  const [supplier, setSupplier] = useState("");
  const [invoice, setInvoice] = useState("");
  const [date, setDate] = useState(istDate());
  const [lines, setLines] = useState<Line[]>([{ key: 1, item_id: "", qty: "", unit: "kg", amount: "", expiry: "" }]);
  const [tax, setTax] = useState("");
  const [paidFull, setPaidFull] = useState(true);
  const [paid, setPaid] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<ClientApiError | null>(null);
  const items = useMemo(() => data?.items ?? [], [data]);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  // suggest the supplier's usual items first
  const sorted = useMemo(() => (supplier ? [...items].sort((a, b) => Number(b.default_supplier_id === supplier) - Number(a.default_supplier_id === supplier)) : items), [items, supplier]);

  const setLine = (k: number, p: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === k ? { ...l, ...p } : l)));
  const subtotal = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const total = subtotal + (Number(tax) || 0);

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      const body = {
        supplier_id: supplier || null,
        invoice_no: invoice,
        purchased_on: date,
        tax: Number(tax) || 0,
        amount_paid: paidFull ? Math.round(total * 100) / 100 : Number(paid) || 0,
        notes,
        lines: lines
          .filter((l) => l.item_id)
          .map((l) => ({ item_id: l.item_id, qty: toBase(Number(l.qty), l.unit), line_total: Number(l.amount) || 0, expiry_date: l.expiry || null })),
      };
      const r = await apiFetch<{ number: number }>("/api/admin/purchases", { body });
      toast(`Purchase #${r.number} recorded — stock updated`);
      onSaved();
      onClose();
    } catch (e) {
      setErr(e as ClientApiError);
    } finally {
      setBusy(false);
    }
  };

  const ready = lines.some((l) => l.item_id) && lines.every((l) => !l.item_id || (Number(l.qty) > 0 && l.amount !== "" && (!byId.get(l.item_id)?.track_expiry || l.expiry)));

  return (
    <Dialog
      open
      side
      size="xl"
      onClose={onClose}
      title="Record purchase"
      description="Enter what the bill says. Amounts are before tax; add the bill's tax below."
      footer={
        <>
          <span className="mr-auto text-[14px]">
            Total <b className="num text-[16px]">{money(total)}</b>
          </span>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy} disabled={!ready}>
            Save purchase
          </Button>
        </>
      }
    >
      {err && <Notice tone="danger" className="mb-3">{err.message}</Notice>}
      {data && !items.length && <Notice tone="warning" className="mb-3">Add inventory items first — a purchase adds stock to existing items.</Notice>}
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Supplier" htmlFor="pf-sup" optional>
          <Select id="pf-sup" value={supplier} onChange={(e) => setSupplier(e.target.value)}>
            <option value="">No supplier / market</option>
            {(data?.suppliers ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Bill / invoice no." htmlFor="pf-inv" optional>
          <Input id="pf-inv" value={invoice} maxLength={40} onChange={(e) => setInvoice(e.target.value)} />
        </Field>
        <Field label="Date" htmlFor="pf-date" error={err?.fields?.purchased_on}>
          <Input id="pf-date" type="date" value={date} max={istDate()} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>

      <h3 className="eyebrow mb-2 mt-5">Items</h3>
      <div className="space-y-2">
        {lines.map((l) => {
          const it = byId.get(l.item_id);
          const base: Unit = it && isUnit(it.display_unit) ? it.display_unit : "kg";
          const perUnit = Number(l.qty) > 0 && Number(l.amount) > 0 ? Number(l.amount) / toBase(Number(l.qty), l.unit) : null;
          const prev = it?.avg_cost != null ? Number(it.avg_cost) : null;
          const jump = perUnit !== null && prev ? (perUnit - prev) / prev : null;
          return (
            <div key={l.key} className="rounded-xl border border-line p-3">
              <div className="grid grid-cols-2 gap-2 md:grid-cols-[minmax(0,2fr)_110px_110px_130px_auto]">
                <Field label="Item" htmlFor={`pl-i-${l.key}`} className="col-span-2 md:col-span-1">
                  <Select
                    id={`pl-i-${l.key}`}
                    value={l.item_id}
                    onChange={(e) => {
                      const x = byId.get(e.target.value);
                      setLine(l.key, { item_id: e.target.value, unit: x && isUnit(x.display_unit) ? x.display_unit : "kg" });
                    }}
                  >
                    <option value="">Choose item…</option>
                    {sorted.map((i) => (
                      <option key={i.id} value={i.id} disabled={lines.some((o) => o.key !== l.key && o.item_id === i.id) && !i.track_expiry}>
                        {i.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Quantity" htmlFor={`pl-q-${l.key}`}>
                  <Input id={`pl-q-${l.key}`} inputMode="decimal" value={l.qty} onChange={(e) => setLine(l.key, { qty: e.target.value.replace(/[^\d.]/g, "") })} />
                </Field>
                <Field label="Unit" htmlFor={`pl-u-${l.key}`}>
                  <Select id={`pl-u-${l.key}`} value={l.unit} disabled={!it} onChange={(e) => setLine(l.key, { unit: e.target.value as Unit })}>
                    {unitsFor(baseOf(base)).map((x) => (
                      <option key={x.value} value={x.value}>
                        {x.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Amount" htmlFor={`pl-a-${l.key}`}>
                  <Input id={`pl-a-${l.key}`} prefix="₹" inputMode="decimal" value={l.amount} onChange={(e) => setLine(l.key, { amount: e.target.value.replace(/[^\d.]/g, "") })} />
                </Field>
                <div className="col-span-2 flex items-end justify-end md:col-span-1">
                  <Button variant="ghost" aria-label="Remove line" icon={<Trash2 size={15} />} disabled={lines.length === 1} onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} />
                </div>
              </div>
              {it && (
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12.5px] text-muted">
                  {perUnit !== null && (
                    <span>
                      = <b className="num text-fg">{formatUnitCost(perUnit, it.display_unit)}</b>
                      {jump !== null && Math.abs(jump) >= 0.15 && <span className="ml-1 font-semibold text-warning">({jump > 0 ? "+" : ""}{Math.round(jump * 100)}% vs usual — check the amount)</span>}
                    </span>
                  )}
                  <span>In stock: {formatQty(Number(it.stock_qty), it.display_unit)}</span>
                  {it.track_expiry && (
                    <label className="flex items-center gap-2">
                      <span className="font-semibold text-fg">Expiry date</span>
                      <Input aria-label="Expiry date" type="date" className="h-8 w-auto" value={l.expiry} min={date} onChange={(e) => setLine(l.key, { expiry: e.target.value })} />
                    </label>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <Button variant="secondary" size="sm" className="mt-2" icon={<Plus size={14} />} onClick={() => setLines((ls) => [...ls, { key: Math.max(...ls.map((x) => x.key)) + 1, item_id: "", qty: "", unit: "kg", amount: "", expiry: "" }])}>
        Add line
      </Button>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Field label="Tax on the bill (GST)" htmlFor="pf-tax" optional hint="Kept separate — it isn't part of the item cost.">
          <Input id="pf-tax" prefix="₹" inputMode="decimal" value={tax} onChange={(e) => setTax(e.target.value.replace(/[^\d.]/g, ""))} />
        </Field>
        <div>
          <Checkbox label="Paid in full" checked={paidFull} onChange={setPaidFull} />
          {!paidFull && (
            <Field label="Amount paid so far" htmlFor="pf-paid" className="mt-2" error={err?.fields?.amount_paid}>
              <Input id="pf-paid" prefix="₹" inputMode="decimal" value={paid} onChange={(e) => setPaid(e.target.value.replace(/[^\d.]/g, ""))} />
            </Field>
          )}
        </div>
      </div>
      <Field label="Notes" htmlFor="pf-notes" optional className="mt-3">
        <Textarea id="pf-notes" rows={2} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <dl className="mt-4 space-y-1 rounded-lg bg-surface-2 px-4 py-3 text-[14px]">
        <div className="flex justify-between">
          <dt className="text-muted">Items</dt>
          <dd className="num">{money(subtotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted">Tax</dt>
          <dd className="num">{money(Number(tax) || 0)}</dd>
        </div>
        <div className="flex justify-between font-bold">
          <dt>Total</dt>
          <dd className="num">{money(total)}</dd>
        </div>
      </dl>
    </Dialog>
  );
}

/* ── Purchase detail ────────────────────────────────────────────────────── */

function PurchaseDrawer({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const { data, error, loading, reload } = useApi<{
    purchase: PurchaseRow & { notes: string; created_by_name: string | null; created_at: string };
    lines: { id: string; name: string; display_unit: string; qty: number; unit_cost: number; line_total: number; expiry_date: string | null }[];
  }>(`/api/admin/purchases/${id}`);
  const can = useCan();
  const toast = useToast();
  const { ask, node } = useConfirm();
  const p = data?.purchase;
  const due = p ? Math.round((Number(p.total) - Number(p.amount_paid)) * 100) / 100 : 0;

  const pay = async () => {
    const r = await ask({ title: "Record payment to supplier", body: `Due: ${money(due)}`, reason: { label: "Amount (₹)", value: String(due), required: true, single: true }, confirm: "Record payment" });
    if (!r.ok) return;
    try {
      await apiFetch(`/api/admin/purchases/${id}/payment`, { body: { amount: Number(r.reason.replace(/[^\d.]/g, "")) } });
      toast("Payment recorded");
      reload();
      onChanged();
    } catch (e) {
      toast((e as ClientApiError).message, "error");
    }
  };
  const cancel = async () => {
    const r = await ask({ title: `Cancel purchase #${p?.number}?`, body: "Use this only for a purchase entered by mistake. Its stock is removed and average costs are recalculated.", reason: { label: "Why?", required: true }, confirm: "Cancel purchase", danger: true });
    if (!r.ok) return;
    try {
      await apiFetch(`/api/admin/purchases/${id}/cancel`, { body: { reason: r.reason } });
      toast("Purchase cancelled");
      reload();
      onChanged();
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
      title={p ? `Purchase #${p.number}` : "Purchase"}
      description={p ? `${dateOf(p.purchased_on)}${p.supplier ? ` · ${p.supplier}` : ""}${p.invoice_no ? ` · bill ${p.invoice_no}` : ""}` : undefined}
      footer={
        p &&
        p.status === "received" &&
        can("purchases.manage") && (
          <>
            <Button variant="ghost" className="mr-auto text-danger" onClick={cancel}>
              Cancel purchase
            </Button>
            {due > 0 && <Button onClick={pay}>Record payment · {money(due)}</Button>}
          </>
        )
      }
    >
      {node}
      <ErrorBlock error={error} retry={reload} />
      {loading || !p || !data ? (
        <LoadingBlock rows={4} />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">{p.status === "cancelled" ? <Badge tone="danger">Cancelled</Badge> : <Badge tone={PAY_TONE[p.payment_status]}>{PAY_LABEL[p.payment_status]}</Badge>}</div>
          <ul className="divide-y divide-line rounded-lg border border-line text-[14px]">
            {data.lines.map((l) => (
              <li key={l.id} className="flex items-start justify-between gap-3 px-3 py-2">
                <div>
                  <p className="font-semibold">{l.name}</p>
                  <p className="text-[12.5px] text-muted">
                    {formatQty(Number(l.qty), l.display_unit)} · {formatUnitCost(Number(l.unit_cost), l.display_unit)}
                    {l.expiry_date && ` · expires ${dateOf(l.expiry_date)}`}
                  </p>
                </div>
                <span className="num font-semibold">{money(Number(l.line_total))}</span>
              </li>
            ))}
          </ul>
          <dl className="space-y-1 text-[14px]">
            {[
              ["Items", money(Number(p.subtotal))],
              ["Tax", money(Number(p.tax))],
              ["Total", money(Number(p.total))],
              ["Paid", money(Number(p.amount_paid))],
              ...(due > 0 && p.status === "received" ? [["Due", money(due)]] : []),
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <dt className="text-muted">{k}</dt>
                <dd className="num font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
          {p.notes && <p className="whitespace-pre-line rounded-lg bg-surface-2 px-3 py-2 text-[13.5px]">{p.notes}</p>}
          <p className="text-[12.5px] text-muted">Recorded by {p.created_by_name ?? "—"}</p>
        </div>
      )}
    </Dialog>
  );
}

/* ── Suppliers ──────────────────────────────────────────────────────────── */

function SuppliersTab() {
  const { data, error, loading, reload } = useApi<{ suppliers: SupplierRow[] }>("/api/admin/suppliers");
  const [edit, setEdit] = useState<SupplierRow | "new" | null>(null);
  return (
    <Card
      padded={false}
      title="Suppliers"
      actions={
        <Button size="sm" icon={<Plus size={14} />} onClick={() => setEdit("new")}>
          Add supplier
        </Button>
      }
    >
      <ErrorBlock error={error} retry={reload} />
      {loading ? (
        <div className="p-4">
          <LoadingBlock rows={4} />
        </div>
      ) : (
        <DataTable
          rows={data?.suppliers ?? []}
          rowKey={(s) => s.id}
          onRowClick={(s) => setEdit(s)}
          empty={<Empty title="No suppliers yet">Add the people and shops you buy from to track what you owe them.</Empty>}
          columns={[
            { key: "n", header: "Supplier", primary: true, cell: (s) => <span className="font-semibold">{s.name} {!s.is_active && <Badge>Inactive</Badge>}</span> },
            { key: "c", header: "Contact", cell: (s) => [s.contact_name, s.phone].filter(Boolean).join(" · ") || <span className="text-muted">—</span> },
            { key: "p", header: "Purchases", align: "right", hideOnCard: true, cell: (s) => <span className="num">{s.purchases}</span> },
            { key: "t", header: "Bought", align: "right", cell: (s) => <span className="num">{money(Number(s.purchased))}</span> },
            { key: "o", header: "You owe", align: "right", cell: (s) => <span className={Number(s.outstanding) > 0 ? "num font-semibold text-warning" : "num text-muted"}>{money(Number(s.outstanding))}</span> },
            { key: "l", header: "Last purchase", hideOnCard: true, cell: (s) => (s.last_purchase ? dateOf(s.last_purchase) : "—") },
            { key: "e", header: <span className="sr-only">Edit</span>, align: "right", hideOnCard: true, cell: () => <Pencil size={14} className="ml-auto text-muted" aria-hidden /> },
          ]}
        />
      )}
      {edit && <SupplierEditor supplier={edit === "new" ? null : edit} onClose={() => setEdit(null)} onSaved={reload} />}
    </Card>
  );
}

function SupplierEditor({ supplier, onClose, onSaved }: { supplier: SupplierRow | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({
    name: supplier?.name ?? "",
    contact_name: supplier?.contact_name ?? "",
    phone: supplier?.phone ?? "",
    email: supplier?.email ?? "",
    gstin: supplier?.gstin ?? "",
    address: supplier?.address ?? "",
    notes: supplier?.notes ?? "",
    is_active: supplier?.is_active ?? true,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<ClientApiError | null>(null);
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      if (supplier) await apiFetch(`/api/admin/suppliers/${supplier.id}`, { method: "PATCH", body: f });
      else await apiFetch("/api/admin/suppliers", { body: f });
      toast("Supplier saved");
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
      onClose={onClose}
      title={supplier ? `Edit ${supplier.name}` : "Add supplier"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy} disabled={f.name.trim().length < 2}>
            Save
          </Button>
        </>
      }
    >
      {err && !err.fields && <Notice tone="danger" className="mb-3">{err.message}</Notice>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" htmlFor="su-name" error={fe.name} className="sm:col-span-2">
          <Input id="su-name" value={f.name} maxLength={80} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field label="Contact person" htmlFor="su-cp" optional>
          <Input id="su-cp" value={f.contact_name} maxLength={60} onChange={(e) => set({ contact_name: e.target.value })} />
        </Field>
        <Field label="Phone" htmlFor="su-ph" optional error={fe.phone}>
          <Input id="su-ph" inputMode="tel" value={f.phone} maxLength={18} onChange={(e) => set({ phone: e.target.value })} />
        </Field>
        <Field label="Email" htmlFor="su-em" optional error={fe.email}>
          <Input id="su-em" type="email" value={f.email} onChange={(e) => set({ email: e.target.value })} />
        </Field>
        <Field label="GSTIN" htmlFor="su-gst" optional error={fe.gstin}>
          <Input id="su-gst" value={f.gstin} maxLength={15} onChange={(e) => set({ gstin: e.target.value.toUpperCase() })} />
        </Field>
        <Field label="Address" htmlFor="su-ad" optional className="sm:col-span-2">
          <Textarea id="su-ad" rows={2} maxLength={200} value={f.address} onChange={(e) => set({ address: e.target.value })} />
        </Field>
        <Field label="Notes" htmlFor="su-no" optional className="sm:col-span-2">
          <Textarea id="su-no" rows={2} maxLength={500} value={f.notes} onChange={(e) => set({ notes: e.target.value })} />
        </Field>
      </div>
      {supplier && (
        <div className="mt-3">
          <Checkbox label="Active" hint="Inactive suppliers are hidden when recording purchases." checked={f.is_active} onChange={(v) => set({ is_active: v })} />
        </div>
      )}
    </Dialog>
  );
}
