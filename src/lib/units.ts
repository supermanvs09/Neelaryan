/**
 * Inventory units. Stock is stored in a base unit (g, ml, pcs, packet); people
 * enter and read the unit they think in (kg, L, dozen…).
 */
export type BaseUnit = "g" | "ml" | "pcs" | "packet";
export type Unit = "g" | "kg" | "ml" | "L" | "pcs" | "dozen" | "packet";

export const UNITS: { value: Unit; label: string; base: BaseUnit; factor: number }[] = [
  { value: "kg", label: "kg", base: "g", factor: 1000 },
  { value: "g", label: "g", base: "g", factor: 1 },
  { value: "L", label: "litre", base: "ml", factor: 1000 },
  { value: "ml", label: "ml", base: "ml", factor: 1 },
  { value: "pcs", label: "pieces", base: "pcs", factor: 1 },
  { value: "dozen", label: "dozen", base: "pcs", factor: 12 },
  { value: "packet", label: "packets", base: "packet", factor: 1 },
];

const byValue = new Map(UNITS.map((u) => [u.value, u]));

export const isUnit = (u: string): u is Unit => byValue.has(u as Unit);
export const baseOf = (unit: Unit): BaseUnit => byValue.get(unit)!.base;
export const unitsFor = (base: BaseUnit) => UNITS.filter((u) => u.base === base);
export const factorOf = (unit: Unit) => byValue.get(unit)!.factor;

/** 1.5 kg → 1500 (g). Rounded to 3 decimals like the database. */
export const toBase = (qty: number, unit: Unit) => Math.round(qty * factorOf(unit) * 1000) / 1000;
export const fromBase = (baseQty: number, unit: Unit) => baseQty / factorOf(unit);

const num = (n: number, max = 2) => new Intl.NumberFormat("en-IN", { maximumFractionDigits: max }).format(n);

/** "1.5 kg", "750 g", "−200 ml", "3 packets". Small amounts drop to the smaller unit. */
export function formatQty(baseQty: number, display: Unit | string): string {
  const d: Unit = isUnit(display) ? display : "pcs";
  const sign = baseQty < 0 ? "−" : "";
  const abs = Math.abs(baseQty);
  let unit = d;
  if ((d === "kg" || d === "L") && abs > 0 && abs < 1000) unit = d === "kg" ? "g" : "ml";
  if (d === "dozen" && abs % 12 !== 0) unit = "pcs";
  const value = fromBase(abs, unit);
  const label = unit === "packet" ? (value === 1 ? "packet" : "packets") : unit === "pcs" ? (value === 1 ? "piece" : "pieces") : unit;
  return `${sign}${num(value, unit === "g" || unit === "ml" || unit === "pcs" ? 1 : 2)} ${label}`;
}

/** Cost per base unit, quoted the way it's bought: per kg, per litre, per piece. */
export function formatUnitCost(costPerBase: number | null, display: Unit | string): string | null {
  if (costPerBase === null || !Number.isFinite(costPerBase)) return null;
  const d: Unit = isUnit(display) ? display : "pcs";
  const unit: Unit = d === "g" ? "kg" : d === "ml" ? "L" : d;
  const per = costPerBase * factorOf(unit);
  return `₹${num(per, per < 10 ? 2 : 0)} / ${unit === "packet" ? "packet" : unit === "pcs" ? "piece" : unit}`;
}
