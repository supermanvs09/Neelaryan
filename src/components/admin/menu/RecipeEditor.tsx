"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button, IconButton, Input, Select } from "../ui";
import { money } from "@/lib/format";
import type { InvOption } from "./types";

/** Ingredient lines (qty in the item's base unit: g, ml, pieces, packets). */
export function RecipeEditor({
  lines,
  onChange,
  inventory,
  compact = false,
}: {
  lines: { inventory_item_id: string; qty: number }[];
  onChange: (l: { inventory_item_id: string; qty: number }[]) => void;
  inventory: InvOption[];
  compact?: boolean;
}) {
  const unitOf = (id: string) => inventory.find((i) => i.id === id)?.base_unit ?? "";
  const set = (i: number, patch: Partial<{ inventory_item_id: string; qty: number }>) => onChange(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  if (!inventory.length) return <p className="text-[13px] text-muted">Add ingredients in Inventory first, then build recipes here.</p>;
  return (
    <div className="space-y-2">
      {lines.map((l, i) => {
        const inv = inventory.find((x) => x.id === l.inventory_item_id);
        const lineCost = inv?.avg_cost != null ? l.qty * Number(inv.avg_cost) : null;
        return (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <Select value={l.inventory_item_id} onChange={(e) => set(i, { inventory_item_id: e.target.value })} className={compact ? "min-w-[150px] flex-1" : "min-w-[200px] flex-1"} aria-label="Ingredient">
              <option value="">Choose ingredient…</option>
              {inventory.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </Select>
            <Input type="number" inputMode="decimal" min={0} step="any" value={l.qty || ""} onChange={(e) => set(i, { qty: Number(e.target.value) })} className="w-[110px]" suffix={unitOf(l.inventory_item_id)} aria-label="Quantity" />
            {!compact && <span className="num w-20 text-right text-[13px] text-muted">{lineCost === null ? "no cost" : money(lineCost)}</span>}
            <IconButton label="Remove ingredient" onClick={() => onChange(lines.filter((_, j) => j !== i))}>
              <Trash2 size={15} />
            </IconButton>
          </div>
        );
      })}
      <Button size="sm" variant="secondary" icon={<Plus size={14} />} onClick={() => onChange([...lines, { inventory_item_id: "", qty: 0 }])}>
        Add ingredient
      </Button>
    </div>
  );
}
