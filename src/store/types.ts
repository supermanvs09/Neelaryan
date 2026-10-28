import type { BuilderKind, Selection } from "@/data/builders";

export type OrderMode = "dine-in" | "takeaway" | "delivery";

export type OrderStatus =
  | "NEW"
  | "ACCEPTED"
  | "PREPARING"
  | "READY"
  | "SERVED"
  | "OUT_FOR_DELIVERY"
  | "COMPLETED"
  | "CANCELLED"
  | "REJECTED";

export type PaymentStatus = "CREATED" | "PENDING" | "PAID" | "FAILED" | "REFUND_PENDING" | "REFUNDED";

export type PaymentMethod = "upi" | "card" | "netbanking" | "counter";

export interface LineDetail {
  label: string;
  value: string;
}

export interface CartLine {
  /** Identity of item + customization; identical customizations merge. */
  key: string;
  itemId: string;
  name: string;
  unitPrice: number;
  qty: number;
  details: LineDetail[];
  notes?: string;
  builder?: { kind: BuilderKind; selection: Selection };
  simple?: Record<string, string>;
}

export interface Customer {
  name: string;
  phone: string;
  email?: string;
  /** yyyy-mm-dd, optional — used for birthday offers */
  dob?: string;
}

export interface Order {
  id: string;
  createdAt: number;
  mode: OrderMode;
  table?: string;
  address?: string;
  customer: Customer;
  lines: CartLine[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  coupon?: string;
  payment: { method: PaymentMethod; status: PaymentStatus };
  status: OrderStatus;
  history: { status: OrderStatus; at: number }[];
  completedAt?: number;
}
