import type { CustomizerKind } from "./menu";

/** Simple (non-builder) customization groups. All free; admin-configurable later. */
export interface SimpleGroup {
  id: string;
  label: string;
  options: string[];
  defaultIndex: number;
}

const SUGAR: SimpleGroup = { id: "sugar", label: "Sugar", options: ["No sugar", "Less sugar", "Regular"], defaultIndex: 2 };
const SWEET: SimpleGroup = { id: "sweetness", label: "Sweetness", options: ["Less sweet", "Regular", "Extra sweet"], defaultIndex: 1 };
const ICE: SimpleGroup = { id: "ice", label: "Ice", options: ["No ice", "Less ice", "Regular ice"], defaultIndex: 2 };
const SODA: SimpleGroup = { id: "style", label: "Flavour style", options: ["Sweet", "Salted", "Masala"], defaultIndex: 0 };
const SPICE: SimpleGroup = { id: "spice", label: "Spice level", options: ["Mild", "Medium", "Spicy"], defaultIndex: 1 };

export const SIMPLE_GROUPS: Record<Exclude<CustomizerKind, "oats-builder" | "shake-builder">, SimpleGroup[]> = {
  tea: [SUGAR],
  coffee: [SUGAR],
  soda: [SODA, ICE],
  cold: [SWEET, ICE],
  spice: [SPICE],
  notes: [],
};

export const NOTES_MAX = 140;

/** Tax applied on (subtotal − discount). Matches the "Taxes (5% GST)" line in the mockups. */
export const GST_RATE = 0.05;

export interface Coupon {
  code: string;
  title: string;
  kind: "flat" | "percent";
  value: number;
  minOrder: number;
  maxDiscount?: number;
}

/** Demo coupons — real ones are created by the owner in Admin → Coupons. */
export const COUPONS: Coupon[] = [
  { code: "NEEL20", title: "₹20 off on orders above ₹199", kind: "flat", value: 20, minOrder: 199 },
  { code: "GOODNESS10", title: "10% off up to ₹50 on orders above ₹299", kind: "percent", value: 10, minOrder: 299, maxDiscount: 50 },
];

export function couponDiscount(c: Coupon, subtotal: number) {
  if (subtotal < c.minOrder) return 0;
  const raw = c.kind === "flat" ? c.value : Math.round((subtotal * c.value) / 100);
  return Math.min(raw, c.maxDiscount ?? raw, subtotal);
}

export const BRANCH = { id: "main", name: "NEELARYAN Café" };

/** Valid dine-in tables for the demo branch (QR codes encode ?table=NN). */
export const TABLES = Array.from({ length: 16 }, (_, i) => String(i + 1).padStart(2, "0"));

export const LOYALTY_TARGET = 10;
export const LOYALTY_REWARD = "1 free signature drink";

export const PREP_ESTIMATE = "15 – 20 mins";
