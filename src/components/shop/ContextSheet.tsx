"use client";

import { create } from "zustand";
import { QrCode, ShoppingBag } from "lucide-react";
import { useMenu } from "@/lib/shop/menu";
import { useShop } from "@/lib/shop/store";
import { Sheet, toast } from "./ui";
import { clsx } from "@/lib/clsx";

export const useContextSheet = create<{ open: boolean; set: (v: boolean) => void }>((set) => ({ open: false, set: (open) => set({ open }) }));

/**
 * Dine-in vs takeaway. Dine-in is only possible by scanning the QR code on a table
 * (so orders always reach the right table); takeaway can be chosen here.
 */
export function ContextSheet() {
  const open = useContextSheet((s) => s.open);
  const set = useContextSheet((s) => s.set);
  const mode = useShop((s) => s.mode);
  const table = useShop((s) => s.table);
  const setMode = useShop((s) => s.setMode);
  const takeaway = useMenu((s) => s.menu?.ordering.takeaway_enabled ?? true);
  return (
    <Sheet open={open} onClose={() => set(false)} title="How are you ordering?">
      <div className="space-y-3 p-5">
        <div className={clsx("rounded-2xl border p-4", mode === "dine_in" && table ? "border-primary bg-primary-soft" : "border-line")}>
          <p className="flex items-center gap-2 font-semibold">
            <QrCode size={18} aria-hidden /> At a table
          </p>
          {table ? (
            <>
              <p className="mt-1 text-[14px] text-muted">
                You scanned Table <b className="text-fg">{table.label}</b>. Your food comes to this table.
              </p>
              {mode !== "dine_in" && (
                <button type="button" className="mt-3 font-semibold text-primary hover:underline" onClick={() => (setMode("dine_in"), set(false), toast(`Ordering for Table ${table.label}`))}>
                  Order for Table {table.label}
                </button>
              )}
            </>
          ) : (
            <p className="mt-1 text-[14px] text-muted">Scan the QR code on your table with your phone camera — the menu opens for that table.</p>
          )}
        </div>
        <button
          type="button"
          disabled={!takeaway}
          onClick={() => {
            setMode("takeaway");
            set(false);
            toast("Ordering for takeaway");
          }}
          className={clsx("w-full rounded-2xl border p-4 text-left disabled:opacity-55", mode === "takeaway" ? "border-primary bg-primary-soft" : "border-line hover:border-line-strong")}
        >
          <p className="flex items-center gap-2 font-semibold">
            <ShoppingBag size={18} aria-hidden /> Takeaway
          </p>
          <p className="mt-1 text-[14px] text-muted">{takeaway ? "Order now, collect from the counter when it's ready." : "Takeaway orders are paused right now."}</p>
        </button>
      </div>
    </Sheet>
  );
}
