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
