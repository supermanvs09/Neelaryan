/**
 * Time-based offers, shared by the browser (to show prices) and the server (which charges).
 * An offer is live when it's active, today is one of its days, the café-time clock is
 * inside its window and today is within its dates. The best live offer per item wins.
 */

export interface Offer {
  id: string;
  title: string;
  percent_off: number;
  /** empty = whole menu */
  menu_item_ids: string[];
  /** ISO weekdays (1 = Monday); empty = every day */
  days: number[];
  /** "HH:MM" or "HH:MM:SS"; "24:00" = end of day */
  starts_at: string;
  ends_at: string;
  valid_from: string | null;
  valid_to: string | null;
  is_active: boolean;
}

export interface CafeClock {
  date: string; // YYYY-MM-DD, café time
  dow: number; // 1 = Monday
  minutes: number; // since midnight, café time
}

const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const DOW: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

export function cafeClock(at: Date = new Date()): CafeClock {
  const p = Object.fromEntries(fmt.formatToParts(at).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, dow: DOW[p.weekday], minutes: Number(p.hour) * 60 + Number(p.minute) };
}

export function toMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function isOfferLive(o: Offer, clock: CafeClock) {
  return (
    o.is_active &&
    (o.days.length === 0 || o.days.includes(clock.dow)) &&
    clock.minutes >= toMinutes(o.starts_at) &&
    clock.minutes < toMinutes(o.ends_at) &&
    (!o.valid_from || clock.date >= o.valid_from) &&
    (!o.valid_to || clock.date <= o.valid_to)
  );
}

export const appliesTo = (o: Offer, menuItemId: string) => o.menu_item_ids.length === 0 || o.menu_item_ids.includes(menuItemId);

/** Highest discount wins; ties by title (same rule everywhere). */
export function bestOffer(menuItemId: string, offers: Offer[], clock: CafeClock): Offer | null {
  let best: Offer | null = null;
  for (const o of offers) {
    if (!appliesTo(o, menuItemId) || !isOfferLive(o, clock)) continue;
    if (!best || o.percent_off > best.percent_off || (o.percent_off === best.percent_off && o.title < best.title)) best = o;
  }
  return best;
}

/** Rupees off one unit's base price (rounded down). */
export const discountFor = (price: number, percentOff: number) => Math.floor((price * percentOff) / 100);

const DAY = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export function timeLabel(t: string) {
  const m = toMinutes(t);
  if (m === 0 || m >= 1440) return "midnight";
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${h % 12 || 12}${min ? `:${String(min).padStart(2, "0")}` : ""} ${h < 12 ? "am" : "pm"}`;
}
export function daysLabel(days: number[]) {
  if (!days.length || days.length === 7) return "Every day";
  const s = [...days].sort((a, b) => a - b).join();
  if (s === "1,2,3,4,5") return "Mon–Fri";
  if (s === "6,7") return "Weekends";
  return [...days].sort((a, b) => a - b).map((d) => DAY[d - 1]).join(", ");
}
export function windowLabel(o: Pick<Offer, "starts_at" | "ends_at">) {
  const s = toMinutes(o.starts_at);
  const e = toMinutes(o.ends_at);
  if (s === 0 && e >= 1440) return "All day";
  if (e >= 1440) return `From ${timeLabel(o.starts_at)}`;
  return `${timeLabel(o.starts_at)}–${timeLabel(o.ends_at)}`;
}
/** When a live offer ends today, or null if it runs to the end of the day. */
export const endsLabel = (o: Offer) => (toMinutes(o.ends_at) >= 1440 ? null : timeLabel(o.ends_at));
