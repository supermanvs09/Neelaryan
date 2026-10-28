"use client";

import type { MenuItem } from "@/data/menu";
import { SIMPLE_GROUPS } from "@/data/config";
import { describeSelection, extrasPrice, recipeFor, type BuilderKind, type Selection } from "@/data/builders";
import type { CartLine } from "@/store/types";
import { useApp } from "@/store/app";
import { useUI } from "@/store/ui";

const keyOf = (parts: unknown[]) => JSON.stringify(parts);

export function defaultChoices(item: MenuItem): Record<string, string> {
  if (item.customizer === "oats-builder" || item.customizer === "shake-builder") return {};
  return Object.fromEntries(SIMPLE_GROUPS[item.customizer].map((g) => [g.id, g.options[g.defaultIndex]]));
}

export function simpleLine(item: MenuItem, choices: Record<string, string>, notes: string, qty: number): CartLine {
  const groups = item.customizer === "oats-builder" || item.customizer === "shake-builder" ? [] : SIMPLE_GROUPS[item.customizer];
  const details = groups.map((g) => ({ label: g.label, value: choices[g.id] ?? g.options[g.defaultIndex] }));
  const n = notes.trim();
  return {
    key: keyOf([item.id, details, n]),
    itemId: item.id,
    name: item.name,
    unitPrice: item.price,
    qty,
    details,
    notes: n || undefined,
    simple: choices,
  };
}

export function builderLine(item: MenuItem, kind: BuilderKind, selection: Selection, notes: string, qty: number): CartLine {
  const recipe = recipeFor(kind, item.id);
  const n = notes.trim();
  const sorted = Object.fromEntries(Object.entries(selection).map(([k, v]) => [k, [...v].sort()]));
  return {
    key: keyOf([item.id, sorted, n]),
    itemId: item.id,
    name: item.name,
    unitPrice: item.price + extrasPrice(kind, recipe, selection),
    qty,
    details: describeSelection(kind, recipe, selection),
    notes: n || undefined,
    builder: { kind, selection },
  };
}

/** Adds to cart with the fly-to-cart cue and a confirmation toast. */
export function addToCart(line: CartLine, from?: HTMLElement | null, color = "#c9a04a") {
  useApp.getState().addLine(line);
  const ui = useUI.getState();
  if (from) ui.flyToCart(from.getBoundingClientRect(), color);
  else ui.landFly(-1);
  ui.showToast(`${line.qty} × ${line.name} added`);
}
