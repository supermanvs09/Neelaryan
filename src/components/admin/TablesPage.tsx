"use client";

import Link from "next/link";
import { useState } from "react";
import { Download, Pencil, Plus, Printer, QrCode, RefreshCw } from "lucide-react";
import { Badge, Button, Checkbox, Dialog, Empty, ErrorBlock, Field, Input, LoadingBlock, Notice, PageHeader, Select, useConfirm, useToast } from "./ui";
import { useCan } from "./AdminShell";
import { apiFetch, useApi, type ClientApiError } from "@/lib/api-client";
import { ago, money } from "@/lib/format";
import { clsx } from "@/lib/clsx";

interface TableRow {
  id: string;
  label: string;
  name: string;
  seats: number;
  area: string;
  is_active: boolean;
  qr_generated_at: string;
  open_orders: number;
  since: string | null;
  due: number;
  ready: number;
  occupied: boolean;
  url: string;
}

export function TablesPage() {
  const { data, error, loading, reload } = useApi<{ tables: TableRow[] }>("/api/admin/tables?all=1", { refreshMs: 10000 });
  const can = useCan();
  const toast = useToast();
  const { ask, node } = useConfirm();
  const [edit, setEdit] = useState<TableRow | "new" | null>(null);
  const [qr, setQr] = useState<TableRow | null>(null);
  const [settle, setSettle] = useState<TableRow | null>(null);
  const tables = data?.tables ?? [];
  const active = tables.filter((t) => t.is_active);
  const occupied = active.filter((t) => t.occupied).length;

  const regenerate = async (t: TableRow) => {
    const r = await ask({ title: `New QR code for table ${t.label}?`, body: "The printed code currently on this table will stop working. Print and place the new code straight away.", confirm: "Create new code", danger: true });
    if (!r.ok) return;
    try {
      await apiFetch(`/api/admin/tables/${t.id}/regenerate`, { method: "POST" });
      toast(`New QR code for table ${t.label}`);
      await reload();
      setQr(null);
    } catch (e) {
      toast((e as ClientApiError).message, "error");
    }
  };

  return (
    <>
      {node}
      <PageHeader
        title="Tables & QR codes"
        description="Each table has its own QR code. Guests who scan it order straight to that table — they never type a table number."
        actions={
          <>
            <Link href="/admin/tables/print" target="_blank">
              <Button variant="secondary" icon={<Printer size={16} />}>
                Print all QR codes
              </Button>
            </Link>
            {can("tables.manage") && (
              <Button icon={<Plus size={16} />} onClick={() => setEdit("new")}>
                Add table
              </Button>
            )}
          </>
        }
      />
      <ErrorBlock error={error} retry={reload} />
      {!loading && (
        <p className="mb-3 text-[14px] text-muted">
          <b className="num text-fg">{active.length - occupied}</b> available · <b className="num text-fg">{occupied}</b> occupied
        </p>
      )}
      {loading ? (
        <LoadingBlock rows={6} />
      ) : !tables.length ? (
        <Empty title="No tables yet" action={can("tables.manage") && <Button onClick={() => setEdit("new")}>Add table</Button>} />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {tables.map((t) => (
            <div key={t.id} className={clsx("rounded-xl border bg-surface p-3", !t.is_active ? "border-dashed border-line opacity-60" : t.occupied ? "border-accent" : "border-line")}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[12px] text-muted">{t.area || "Table"}</p>
                  <p className="num text-[24px] font-bold leading-tight">{t.label}</p>
                  {t.name && <p className="truncate text-[12.5px] text-muted">{t.name}</p>}
                </div>
                {!t.is_active ? <Badge>Off</Badge> : t.occupied ? <Badge tone="accent">Occupied</Badge> : <Badge tone="success">Free</Badge>}
              </div>
              <p className="mt-2 min-h-[36px] text-[12.5px] text-muted">
                {t.occupied ? (
                  <>
                    {t.open_orders} open order{t.open_orders === 1 ? "" : "s"} · since {ago(t.since!)}
                    <br />
                    Due <b className="num text-fg">{money(t.due)}</b>
                    {t.ready > 0 && <span className="font-semibold text-success"> · {t.ready} ready</span>}
                  </>
                ) : (
                  `${t.seats} seats`
                )}
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                <Button size="sm" variant="secondary" icon={<QrCode size={14} />} onClick={() => setQr(t)}>
                  QR
                </Button>
                {t.occupied && can("billing.manage") && (
                  <Button size="sm" variant="accent" onClick={() => setSettle(t)}>
                    Settle
                  </Button>
                )}
                {can("tables.manage") && (
                  <Button size="sm" variant="ghost" icon={<Pencil size={13} />} onClick={() => setEdit(t)} aria-label={`Edit table ${t.label}`} />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {qr && (
        <Dialog
          open
          onClose={() => setQr(null)}
          size="sm"
          title={`Table ${qr.label} QR code`}
          description="Guests scan this to open the menu for this table."
          footer={
            <>
              {can("tables.manage") && (
                <Button variant="ghost" className="mr-auto text-danger" icon={<RefreshCw size={14} />} onClick={() => regenerate(qr)}>
                  New code
                </Button>
              )}
              <a href={`/api/admin/tables/${qr.id}/qr?format=svg&download=1`}>
                <Button variant="secondary" icon={<Download size={14} />}>
                  SVG
                </Button>
              </a>
              <a href={`/api/admin/tables/${qr.id}/qr?format=png&download=1`}>
                <Button icon={<Download size={14} />}>PNG</Button>
              </a>
            </>
          }
        >
          <div className="mx-auto w-full max-w-[260px] rounded-lg border border-line bg-[#fff] p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/admin/tables/${qr.id}/qr?format=svg&v=${encodeURIComponent(qr.qr_generated_at)}`} alt={`QR code for table ${qr.label}`} className="w-full" />
          </div>
          <p className="mt-3 break-all text-center text-[12.5px] text-muted">{qr.url}</p>
        </Dialog>
      )}

      {edit && <TableEditor table={edit === "new" ? null : edit} onClose={() => setEdit(null)} onSaved={reload} />}
      {settle && <SettleDialog table={settle} onClose={() => setSettle(null)} onDone={reload} />}
    </>
  );
}

function TableEditor({ table, onClose, onSaved }: { table: TableRow | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ label: table?.label ?? "", name: table?.name ?? "", seats: String(table?.seats ?? 4), area: table?.area ?? "", is_active: table?.is_active ?? true });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<ClientApiError | null>(null);
  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      const body = { ...f, seats: Number(f.seats) };
      if (table) await apiFetch(`/api/admin/tables/${table.id}`, { method: "PATCH", body });
      else await apiFetch("/api/admin/tables", { body });
      toast("Table saved");
      onSaved();
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
      onClose={onClose}
      size="sm"
      title={table ? `Edit table ${table.label}` : "Add table"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy} disabled={!f.label.trim()}>
            Save
          </Button>
        </>
      }
    >
      {err && <Notice tone="danger" className="mb-3">{err.message}</Notice>}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Table number" htmlFor="t-label" error={err?.fields?.label}>
          <Input id="t-label" value={f.label} maxLength={12} onChange={(e) => setF({ ...f, label: e.target.value })} />
        </Field>
        <Field label="Seats" htmlFor="t-seats">
          <Input id="t-seats" type="number" min={1} max={50} value={f.seats} onChange={(e) => setF({ ...f, seats: e.target.value })} />
        </Field>
        <Field label="Area" htmlFor="t-area" optional>
          <Input id="t-area" value={f.area} maxLength={40} placeholder="Indoor, Patio…" onChange={(e) => setF({ ...f, area: e.target.value })} />
        </Field>
        <Field label="Name" htmlFor="t-name" optional>
          <Input id="t-name" value={f.name} maxLength={40} placeholder="Window seat" onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
      </div>
      <div className="mt-3">
        <Checkbox label="In use" hint="Switch off a table you've removed — its QR code stops working." checked={f.is_active} onChange={(v) => setF({ ...f, is_active: v })} />
      </div>
    </Dialog>
  );
}

function SettleDialog({ table, onClose, onDone }: { table: TableRow; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<ClientApiError | null>(null);
  const go = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await apiFetch<{ paid: number; completed: number; still_open: number }>(`/api/admin/tables/${table.id}/settle`, { body: { method, reference } });
      toast(`Table ${table.label}: ${money(r.paid)} collected${r.still_open ? ` · ${r.still_open} order(s) still being prepared` : " · table released"}`);
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
      onClose={onClose}
      size="sm"
      title={`Settle table ${table.label}`}
      description={`${table.open_orders} open order(s)`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={go} loading={busy}>
            Collect {money(table.due)}
          </Button>
        </>
      }
    >
      {err && <Notice tone="danger" className="mb-3">{err.message}</Notice>}
      <p className="mb-3 text-[14px]">Records the payment for every open order on this table and completes the ones already served, freeing the table.</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Paid by">
          <Select value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="cash">Cash</option>
            <option value="upi">UPI</option>
            <option value="card">Card</option>
            <option value="other">Other</option>
          </Select>
        </Field>
        <Field label="Reference" optional>
          <Input value={reference} maxLength={60} onChange={(e) => setReference(e.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
}
