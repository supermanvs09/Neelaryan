"use client";

import { Badge, type BadgeTone } from "../ui";

export type OrderStatus = "new" | "accepted" | "preparing" | "ready" | "served" | "completed" | "cancelled" | "rejected";
export type PaymentStatus = "unpaid" | "partial" | "paid" | "refunded";

export interface OrderLine {
  name: string;
  variant: string;
  qty: number;
  modifiers: { name: string; group: string; price: number }[];
  notes: string;
}

export interface OrderRow {
  id: string;
  number: number;
  type: "dine_in" | "takeaway";
  channel: "qr" | "web" | "pos";
  price_tier: "retail" | "wholesale";
  status: OrderStatus;
  payment_status: PaymentStatus;
  total: number;
  amount_paid: number;
  discount: number;
  customer_name: string;
  customer_phone: string;
  notes: string;
  created_at: string;
  accepted_at: string | null;
  ready_at: string | null;
  table_label: string | null;
  table_id: string | null;
  customer_id: string | null;
  payment_method?: "cash" | "upi" | "counter";
  upi_claimed_at?: string | null;
  scheduled_for?: string | null;
  items: OrderLine[];
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  new: "New",
  accepted: "Accepted",
  preparing: "Preparing",
  ready: "Ready",
  served: "Served",
  completed: "Completed",
  cancelled: "Cancelled",
  rejected: "Rejected",
};

const STATUS_TONE: Record<OrderStatus, BadgeTone> = {
  new: "accent",
  accepted: "primary",
  preparing: "primary",
  ready: "success",
  served: "neutral",
  completed: "neutral",
  cancelled: "danger",
  rejected: "danger",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}

export function PaymentBadge({ status, refundDue }: { status: PaymentStatus; refundDue?: boolean }) {
  if (refundDue) return <Badge tone="danger">Refund due</Badge>;
  const map: Record<PaymentStatus, [string, BadgeTone]> = { unpaid: ["Unpaid", "warning"], partial: ["Part paid", "warning"], paid: ["Paid", "success"], refunded: ["Refunded", "neutral"] };
  const [label, tone] = map[status];
  return <Badge tone={tone}>{label}</Badge>;
}

export const typeLabel = (o: { type: string; table_label: string | null; price_tier?: string }) =>
  o.type === "dine_in" ? (o.table_label ? `Table ${o.table_label}` : "Dine-in") : o.price_tier === "wholesale" ? "Wholesale" : "Takeaway";

/** Kitchen-readable list of what was chosen: chosen options, then "No …" removals. */
export function modifierText(mods: { name: string; group: string }[]) {
  const chosen = mods.filter((m) => m.group !== "removed").map((m) => m.name);
  const removed = mods.filter((m) => m.group === "removed").map((m) => m.name);
  return [...chosen, ...removed].join(", ");
}

export const NEXT_LABEL: Partial<Record<OrderStatus, string>> = {
  accepted: "Accept",
  preparing: "Start preparing",
  ready: "Mark ready",
  served: "Mark served",
  completed: "Complete",
};

/** A short two-tone chime for new orders (Web Audio — no files). */
export function chime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [880, 1320].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.18);
      g.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + i * 0.18 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.18 + 0.5);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.18);
      o.stop(ctx.currentTime + i * 0.18 + 0.55);
    });
  } catch {
    /* audio unavailable */
  }
}

export const timeShort = (v: string) => new Date(v).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

export function minutesSince(iso: string, now: number) {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
}

const escHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Kitchen ticket for 58 mm or 80 mm thermal printers (no prices; big order number). */
export function printTicket(
  o: { number: number; type: string; table_label: string | null; customer_name?: string; notes?: string; created_at: string; scheduled_for?: string | null; items: { qty: number; name: string; variant_name?: string; variant?: string; modifiers: { name: string; group: string }[]; notes: string }[] },
  width: 58 | 80,
) {
  const w = window.open("", "_blank", "width=380,height=640");
  if (!w) return;
  const t = (v: string) => new Date(v).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
  const items = o.items
    .map((i) => {
      const v = i.variant_name ?? i.variant ?? "";
      const mods = modifierText(i.modifiers);
      return `<div class="i"><b>${i.qty} × ${escHtml(i.name)}</b>${v ? ` (${escHtml(v)})` : ""}${mods ? `<div class="m">${escHtml(mods)}</div>` : ""}${i.notes ? `<div class="m">“${escHtml(i.notes)}”</div>` : ""}</div>`;
    })
    .join("");
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Ticket #${o.number}</title><style>
    @page{size:${width}mm auto;margin:2mm}
    body{width:${width - 4}mm;margin:0;font:${width === 58 ? 12 : 13}px/1.35 ui-monospace,Menlo,Consolas,monospace;color:#000}
    h1{font-size:${width === 58 ? 26 : 32}px;margin:0 0 2px;text-align:center}
    .c{text-align:center}.i{padding:4px 0;border-bottom:1px dashed #000}.m{padding-left:10px}
    .big{font-size:15px;font-weight:700;text-align:center;border:1.5px solid #000;padding:3px;margin:4px 0}
  </style></head><body>
    <h1>#${o.number}</h1>
    <div class="big">${escHtml(typeLabel(o))}</div>
    <div class="c">${t(o.created_at)}${o.customer_name ? ` · ${escHtml(o.customer_name)}` : ""}</div>
    ${o.scheduled_for ? `<div class="big">PICKUP ${t(o.scheduled_for)}</div>` : ""}
    ${items}
    ${o.notes ? `<p><b>Note:</b> ${escHtml(o.notes)}</p>` : ""}
    <script>window.onload=function(){window.print();setTimeout(function(){window.close()},300)}</script>
  </body></html>`);
  w.document.close();
}
