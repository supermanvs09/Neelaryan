const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const inr2 = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const TZ = "Asia/Kolkata";

/** ₹1,234 (rounded) — for customer-facing prices. */
export const rupees = (n: number) => `₹${inr.format(Math.round(n))}`;

/** ₹1,234.50 / ₹1,234 — exact amounts for bills and finance. */
export const money = (n: number | null | undefined) => {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return "—";
  const v = Number(n);
  const sign = v < 0 ? "−" : "";
  const abs = Math.abs(v);
  return `${sign}₹${Number.isInteger(Math.round(abs * 100) / 100) ? inr.format(abs) : inr2.format(abs)}`;
};

export const pct = (n: number | null | undefined, digits = 1) => (n === null || n === undefined || !Number.isFinite(n) ? "—" : `${(n * 100).toFixed(digits)}%`);

const toDate = (v: number | string | Date) => (v instanceof Date ? v : new Date(v));

export const timeOf = (v: number | string | Date) => toDate(v).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: TZ });

export const dateOf = (v: number | string | Date) => toDate(v).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: TZ });

export const dateTime = (v: number | string | Date | null | undefined) =>
  v ? toDate(v).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: TZ }) : "—";

/** yyyy-mm-dd of the café's business day (IST). */
export function istDate(v: number | string | Date = Date.now()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(toDate(v));
  return parts;
}

export function addDays(day: string, n: number) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** "3 min ago", "2 h ago", or a date. */
export function ago(v: number | string | Date) {
  const s = Math.max(0, (Date.now() - toDate(v).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return dateOf(v);
}

/** Local calendar day key, used for "one per day" rules on the device. */
export const dayKey = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export const orderNo = (n: number | string) => `#${n}`;
