"use client";

import { useEffect, useState } from "react";
import { UtensilsCrossed, ShoppingBag, Bike, QrCode } from "lucide-react";
import { Sheet } from "../ui/Sheet";
import { useApp } from "@/store/app";
import type { OrderMode } from "@/store/types";
import { TABLES } from "@/data/config";
import { clsx } from "@/lib/clsx";

export function modeLabel(mode: OrderMode | null, table: string | null) {
  if (mode === "dine-in") return table ? `Dine in · Table ${table}` : "Dine in · choose table";
  if (mode === "takeaway") return "Takeaway";
  if (mode === "delivery") return "Delivery";
  return "Choose how to order";
}

export const MODES: { id: OrderMode; title: string; sub: string; icon: typeof UtensilsCrossed }[] = [
  { id: "dine-in", title: "Dine in", sub: "Order from your table", icon: UtensilsCrossed },
  { id: "takeaway", title: "Takeaway", sub: "Pick up at the counter", icon: ShoppingBag },
  { id: "delivery", title: "Delivery", sub: "We bring it to you", icon: Bike },
];

/** Change order type / table at any time. */
export function ModePicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const mode = useApp((s) => s.mode);
  const table = useApp((s) => s.table);
  const setMode = useApp((s) => s.setMode);
  const [m, setM] = useState<OrderMode>(mode ?? "dine-in");
  const [t, setT] = useState<string | null>(table);

  useEffect(() => {
    if (open) {
      setM(mode ?? "dine-in");
      setT(table);
    }
  }, [open, mode, table]);

  const canSave = m !== "dine-in" || !!t;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="How would you like to order?"
      footer={
        <button
          className="btn-primary w-full"
          disabled={!canSave}
          onClick={() => {
            setMode(m, m === "dine-in" ? t : null);
            onClose();
          }}
        >
          {canSave ? "Save" : "Choose your table"}
        </button>
      }
    >
      <div className="space-y-5 px-5 pb-5 md:px-7">
        <div className="grid grid-cols-3 gap-2.5" role="radiogroup" aria-label="Order type">
          {MODES.map((o) => {
            const Icon = o.icon;
            const on = m === o.id;
            return (
              <button
                key={o.id}
                role="radio"
                aria-checked={on}
                onClick={() => setM(o.id)}
                className={clsx(
                  "flex min-h-[96px] flex-col items-center justify-center gap-1.5 rounded-2xl border px-2 text-center transition-colors",
                  on ? "border-navy-800 bg-navy-800 text-ivory shadow-lift" : "border-sand-400 bg-white/70 text-navy-800 hover:border-gold-500",
                )}
              >
                <Icon size={22} />
                <span className="text-[14px] font-bold">{o.title}</span>
                <span className={clsx("text-[11px] leading-tight", on ? "text-ivory/75" : "text-ink-muted")}>{o.sub}</span>
              </button>
            );
          })}
        </div>

        {m === "dine-in" && (
          <div>
            <p className="mb-2 flex items-center gap-2 text-[14px] font-semibold text-navy-900">
              <QrCode size={16} className="text-gold-600" /> Scanned the table QR? It fills this in. Or pick your table:
            </p>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-8" role="radiogroup" aria-label="Table number">
              {TABLES.map((n) => (
                <button
                  key={n}
                  role="radio"
                  aria-checked={t === n}
                  onClick={() => setT(n)}
                  className={clsx(
                    "h-12 rounded-xl border text-[15px] font-bold tabular-nums transition-colors",
                    t === n ? "border-gold-500 bg-gold-200 text-navy-900" : "border-sand-400 bg-white/70 text-navy-800 hover:border-gold-500",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}
        {m === "delivery" && <p className="rounded-2xl bg-cream px-4 py-3 text-[14px] text-ink-soft">You&apos;ll add your delivery address at checkout.</p>}
      </div>
    </Sheet>
  );
}
