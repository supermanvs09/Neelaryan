"use client";

import { useState } from "react";
import { CalendarClock, Printer, Smartphone } from "lucide-react";
import { Badge, Button, Dialog, ErrorBlock, Field, Input, LoadingBlock, Notice, Select, Textarea, useToast } from "../ui";
import { useCan } from "../AdminShell";
import { apiFetch, useApi, type ClientApiError } from "@/lib/api-client";
import { dateTime, money } from "@/lib/format";
import { modifierText, printTicket, NEXT_LABEL, PaymentBadge, StatusBadge, STATUS_LABEL, typeLabel, type OrderStatus, type PaymentStatus } from "./shared";

interface Detail {
  id: string;
  number: number;
  type: "dine_in" | "takeaway";
  channel: string;
  price_tier: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  subtotal: number;
  discount: number;
  service_charge: number;
  tax: number;
  total: number;
  amount_paid: number;
  points_used: number;
  customer_name: string;
  customer_phone: string;
  customer_id: string | null;
  customer_account_name: string | null;
  notes: string;
  table_label: string | null;
  created_at: string;
  created_by_name: string | null;
  cancel_reason: string | null;
  payment_method: "cash" | "upi" | "counter";
  upi_claimed_at: string | null;
  upi_reference: string | null;
  scheduled_for: string | null;
  items: { id: string; name: string; variant_name: string; modifiers: { name: string; group: string; price: number }[]; qty: number; unit_price: number; line_total: number; unit_cost?: number | null; notes: string; discount?: number; offer_title?: string | null }[];
  payments: { id: string; kind: string; method: string; amount: number; reference: string; created_at: string; by: string | null }[];
  events: { status: string; note: string; at: string; by: string | null }[];
  next: OrderStatus[];
}

export function OrderDrawer({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const { data, error, loading, reload } = useApi<{ order: Detail }>(`/api/admin/orders/${id}`);
  const can = useCan();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [mode, setMode] = useState<null | "pay" | "refund" | "cancel" | "reject">(null);
  const [method, setMethod] = useState("cash");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<ClientApiError | null>(null);
  const o = data?.order;
  const due = o ? Math.round((o.total - o.amount_paid) * 100) / 100 : 0;
  const refundDue = !!o && (o.status === "cancelled" || o.status === "rejected") && o.amount_paid > 0;

  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    setErr(null);
    try {
      await fn();
      toast(ok);
      setMode(null);
      setReason("");
      setReference("");
      await reload();
      onChanged();
    } catch (e) {
      setErr(e as ClientApiError);
    } finally {
      setBusy(null);
    }
  };

  const move = (to: OrderStatus) => run(to, () => apiFetch(`/api/admin/orders/${id}/status`, { body: { to, reason: reason || undefined } }), `Order marked ${STATUS_LABEL[to].toLowerCase()}`);

  const print = () => {
    const w = window.open("", "_blank", "width=420,height=640");
    if (!w || !o) return;
    const rows = o.items
      .map((i) => `<tr><td>${i.qty} × ${esc(i.name)}${i.variant_name ? ` (${esc(i.variant_name)})` : ""}${i.modifiers.length ? `<br><small>${esc(modifierText(i.modifiers))}</small>` : ""}</td><td style="text-align:right">${money(i.line_total)}</td></tr>`)
      .join("");
    w.document.write(`<html><head><title>Bill #${o.number}</title><style>body{font:13px system-ui;margin:16px;color:#111}h1{font-size:16px;margin:0}table{width:100%;border-collapse:collapse}td{padding:4px 0;vertical-align:top;border-bottom:1px dashed #ccc}.t td{border:0}small{color:#555}</style></head><body>
      <h1>NEELARYAN Café</h1><p>Bill #${o.number} · ${typeLabel(o)}<br>${new Date(o.created_at).toLocaleString("en-IN")}</p>
      <table>${rows}</table><table class="t"><tr><td>Subtotal</td><td style="text-align:right">${money(o.subtotal)}</td></tr>
      ${o.discount ? `<tr><td>Discount</td><td style="text-align:right">−${money(o.discount)}</td></tr>` : ""}
      ${o.service_charge ? `<tr><td>Service charge</td><td style="text-align:right">${money(o.service_charge)}</td></tr>` : ""}
      <tr><td>GST</td><td style="text-align:right">${money(o.tax)}</td></tr><tr><td><b>Total</b></td><td style="text-align:right"><b>${money(o.total)}</b></td></tr>
      <tr><td>Paid</td><td style="text-align:right">${money(o.amount_paid)}</td></tr></table><p>Thank you — crave the goodness.</p><script>window.print()</script></body></html>`);
    w.document.close();
  };

  return (
    <Dialog open onClose={onClose} side size="lg" title={o ? `Order #${o.number}` : "Order"} description={o ? `${typeLabel(o)} · ${dateTime(o.created_at)}` : undefined}>
      <ErrorBlock error={error} retry={reload} />
      {loading || !o ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={o.status} />
            <PaymentBadge status={o.payment_status} refundDue={refundDue} />
            {o.price_tier === "wholesale" && <Badge tone="accent">Wholesale</Badge>}
            <Badge>{o.channel === "qr" ? "Table QR" : o.channel === "web" ? "Online" : "Counter"}</Badge>
            <span className="ml-auto flex gap-1.5">
              <Select aria-label="Print kitchen ticket" value="" className="h-8 w-auto text-[13px]" onChange={(e) => e.target.value && printTicket(o, Number(e.target.value) as 58 | 80)}>
                <option value="">Kitchen ticket…</option>
                <option value="80">80 mm printer</option>
                <option value="58">58 mm printer</option>
              </Select>
              <Button size="sm" variant="secondary" icon={<Printer size={14} />} onClick={print}>
                Print bill
              </Button>
            </span>
          </div>
          {o.scheduled_for && !["completed", "cancelled", "rejected"].includes(o.status) && (
            <Notice tone="primary">
              <span className="flex items-center gap-2">
                <CalendarClock size={16} aria-hidden /> Pre-order for pickup at <b>{new Date(o.scheduled_for).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })}</b>. The kitchen sees it 15 minutes before.
              </span>
            </Notice>
          )}
          {o.payment_method === "upi" && o.payment_status !== "paid" && o.payment_status !== "refunded" && !["cancelled", "rejected"].includes(o.status) && (
            <Notice tone={o.upi_claimed_at ? "warning" : "primary"}>
              <div className="flex flex-wrap items-center gap-2">
                <Smartphone size={16} aria-hidden />
                <span className="min-w-0 flex-1">
                  {o.upi_claimed_at ? (
                    <>
                      Guest says they paid <b>{money(due)}</b> by UPI at {dateTime(o.upi_claimed_at)}
                      {o.upi_reference ? (
                        <>
                          {" "}· ref <b className="num">{o.upi_reference}</b>
                        </>
                      ) : null}
                      . Check your UPI app before confirming.
                    </>
                  ) : (
                    <>Guest chose to pay by UPI. Waiting for them to pay.</>
                  )}
                </span>
                {o.upi_claimed_at && due > 0 && can("billing.manage") && (
                  <Button
                    size="sm"
                    loading={busy === "upi"}
                    onClick={() => run("upi", () => apiFetch(`/api/admin/orders/${id}/payments`, { body: { method: "upi", amount: due, reference: o.upi_reference ?? "" } }), "UPI payment confirmed")}
                  >
                    Received · confirm
                  </Button>
                )}
              </div>
            </Notice>
          )}

          {err && <Notice tone="danger">{err.message}</Notice>}
          {o.cancel_reason && <Notice tone="danger">Reason: {o.cancel_reason}</Notice>}

          {/* actions */}
          {(o.next.length > 0 || due > 0) && (
            <div className="flex flex-wrap gap-2 rounded-lg border border-line bg-surface-2/50 p-3">
              {o.next
                .filter((s) => s !== "cancelled" && s !== "rejected")
                .map((s) => (
                  <Button key={s} onClick={() => move(s)} loading={busy === s} disabled={s === "completed" && o.payment_status !== "paid"} title={s === "completed" && o.payment_status !== "paid" ? "Record the payment first" : undefined}>
                    {NEXT_LABEL[s] ?? STATUS_LABEL[s]}
                  </Button>
                ))}
              {due > 0 && can("billing.manage") && !["cancelled", "rejected"].includes(o.status) && (
                <Button
                  variant="accent"
                  onClick={() => {
                    setMode("pay");
                    setAmount(String(due));
                  }}
                >
                  Record payment · {money(due)}
                </Button>
              )}
              {o.next.includes("rejected") && can("orders.manage") && (
                <Button variant="secondary" onClick={() => setMode("reject")}>
                  Reject
                </Button>
              )}
              {o.next.includes("cancelled") && can("orders.manage") && (
                <Button variant="ghost" className="text-danger" onClick={() => setMode("cancel")}>
                  Cancel order
                </Button>
              )}
              {o.amount_paid > 0 && can("billing.refund") && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setMode("refund");
                    setAmount(String(o.amount_paid));
                  }}
                >
                  Refund
                </Button>
              )}
            </div>
          )}

          {(mode === "pay" || mode === "refund") && (
            <div className="space-y-3 rounded-lg border border-line p-3">
              <p className="text-[14px] font-bold">{mode === "pay" ? "Record a payment" : "Record a refund"}</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Method">
                  <Select value={method} onChange={(e) => setMethod(e.target.value)}>
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="card">Card</option>
                    <option value="other">Other</option>
                  </Select>
                </Field>
                <Field label="Amount">
                  <Input type="number" min={0} step="0.01" prefix="₹" value={amount} onChange={(e) => setAmount(e.target.value)} />
                </Field>
                <Field label="Reference" optional>
                  <Input value={reference} maxLength={60} placeholder={method === "upi" ? "UTR" : ""} onChange={(e) => setReference(e.target.value)} />
                </Field>
              </div>
              {mode === "refund" && (
                <Field label="Reason">
                  <Textarea rows={2} value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} />
                </Field>
              )}
              <div className="flex gap-2">
                <Button
                  loading={busy === mode}
                  disabled={!(Number(amount) > 0) || (mode === "refund" && reason.trim().length < 3)}
                  onClick={() =>
                    run(
                      mode,
                      () => apiFetch(`/api/admin/orders/${id}/${mode === "pay" ? "payments" : "refunds"}`, { body: { method, amount: Number(amount), reference, reason: mode === "refund" ? reason : undefined } }),
                      mode === "pay" ? "Payment recorded" : "Refund recorded",
                    )
                  }
                >
                  Save
                </Button>
                <Button variant="secondary" onClick={() => setMode(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {(mode === "cancel" || mode === "reject") && (
            <div className="space-y-3 rounded-lg border border-danger/40 p-3">
              <Field label={mode === "cancel" ? "Why is this order being cancelled?" : "Why is this order being rejected?"}>
                <Textarea rows={2} value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} />
              </Field>
              {o.amount_paid > 0 && <Notice tone="warning">This order has been paid ({money(o.amount_paid)}). Record a refund after cancelling.</Notice>}
              <div className="flex gap-2">
                <Button variant="danger" disabled={!reason.trim()} loading={busy === (mode === "cancel" ? "cancelled" : "rejected")} onClick={() => move(mode === "cancel" ? "cancelled" : "rejected")}>
                  {mode === "cancel" ? "Cancel order" : "Reject order"}
                </Button>
                <Button variant="secondary" onClick={() => setMode(null)}>
                  Keep order
                </Button>
              </div>
            </div>
          )}

          <section>
            <h3 className="mb-2 text-[13px] font-bold uppercase tracking-wide text-muted">Items</h3>
            <ul className="divide-y divide-line rounded-lg border border-line">
              {o.items.map((i) => (
                <li key={i.id} className="flex justify-between gap-3 px-3 py-2.5 text-[14px]">
                  <span className="min-w-0">
                    <b className="num">{i.qty} ×</b> {i.name}
                    {i.variant_name && <span className="text-muted"> · {i.variant_name}</span>}
                    {i.modifiers.length > 0 && <span className="block text-[12.5px] text-muted">{modifierText(i.modifiers)}</span>}
                    {i.notes && <span className="block text-[12.5px] font-semibold text-warning">Note: {i.notes}</span>}
                    {i.offer_title && Number(i.discount) > 0 && <span className="block text-[12.5px] text-success">{i.offer_title} · −{money(Number(i.discount) * i.qty)}</span>}
                  </span>
                  <span className="num shrink-0 text-right">
                    {money(i.line_total)}
                    {i.unit_cost != null && <span className="block text-[11.5px] text-muted">cost {money(i.unit_cost * i.qty)}</span>}
                  </span>
                </li>
              ))}
            </ul>
            {o.notes && <Notice className="mt-2">Order note: {o.notes}</Notice>}
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            <dl className="space-y-1 text-[14px]">
              <Row k="Subtotal" v={money(o.subtotal)} />
              {o.discount > 0 && <Row k={`Discount${o.points_used ? ` (${o.points_used} pts)` : ""}`} v={`−${money(o.discount)}`} />}
              {o.service_charge > 0 && <Row k="Service charge" v={money(o.service_charge)} />}
              <Row k="GST" v={money(o.tax)} />
              <Row k="Total" v={money(o.total)} strong />
              <Row k="Paid" v={money(o.amount_paid)} />
            </dl>
            <dl className="space-y-1 text-[14px]">
              <Row k="Customer" v={o.customer_account_name ?? (o.customer_name || "Walk-in")} />
              {o.customer_phone && <Row k="Phone" v={o.customer_phone} />}
              {o.customer_id && <Row k="Loyalty" v="Linked account" />}
              {o.created_by_name && <Row k="Entered by" v={o.created_by_name} />}
            </dl>
          </section>

          {o.payments.length > 0 && (
            <section>
              <h3 className="mb-2 text-[13px] font-bold uppercase tracking-wide text-muted">Payments</h3>
              <ul className="space-y-1 text-[13.5px]">
                {o.payments.map((p) => (
                  <li key={p.id} className="flex justify-between gap-2">
                    <span>
                      {p.kind === "refund" ? "Refund" : "Payment"} · {p.method.toUpperCase()}
                      {p.reference && <span className="text-muted"> · {p.reference}</span>}
                      <span className="text-muted"> · {dateTime(p.created_at)}{p.by ? ` · ${p.by}` : ""}</span>
                    </span>
                    <span className={p.kind === "refund" ? "num text-danger" : "num"}>{p.kind === "refund" ? "−" : ""}{money(p.amount)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h3 className="mb-2 text-[13px] font-bold uppercase tracking-wide text-muted">History</h3>
            <ol className="space-y-1 text-[13px] text-muted">
              {o.events.map((e, i) => (
                <li key={i}>
                  {dateTime(e.at)} — <span className="text-fg">{STATUS_LABEL[e.status as OrderStatus] ?? e.status}</span>
                  {e.by ? ` by ${e.by}` : ""}
                  {e.note ? ` (${e.note})` : ""}
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}
    </Dialog>
  );
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{k}</dt>
      <dd className={strong ? "num font-bold" : "num"}>{v}</dd>
    </div>
  );
}
