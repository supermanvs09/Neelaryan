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

export function minutesSince(iso: string, now: number) {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
}
