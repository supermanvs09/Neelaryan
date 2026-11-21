"use client";

import Link from "next/link";
import { create } from "zustand";
import { AlertCircle, ShoppingBag, Trash2 } from "lucide-react";
import { useMenu, itemById } from "@/lib/shop/menu";
import { priceCart, totalsFor, useShop } from "@/lib/shop/store";
import { Sheet, ShopButton, Stepper, rupee } from "./ui";
import { ItemVisual } from "./ItemVisual";
import { useOpenItem } from "./ItemSheet";
import { visualKeys } from "@/lib/shop/menu";

export const useCartSheet = create<{ open: boolean; set: (v: boolean) => void }>((set) => ({ open: false, set: (open) => set({ open }) }));

export function CartSheet() {
  const open = useCartSheet((s) => s.open);
  const setOpen = useCartSheet((s) => s.set);
  const menu = useMenu((s) => s.menu);
  const cart = useShop((s) => s.cart);
  const setQty = useShop((s) => s.setQty);
  const mode = useShop((s) => s.mode);
  const table = useShop((s) => s.table);
  const openItem = useOpenItem();
  const { lines, subtotal, count, blocked } = priceCart(menu, cart);
  const t = totalsFor(menu, subtotal, 0);

  return (
    <Sheet
      open={open}
      onClose={() => setOpen(false)}
      side
      title={count ? `Your order · ${count} item${count === 1 ? "" : "s"}` : "Your order"}
      footer={
        count > 0 && (
          <div>
            <dl className="mb-3 space-y-1 text-[14px]">
              <div className="flex justify-between text-muted">
                <dt>Items</dt>
                <dd className="num">{rupee(t.subtotal)}</dd>
              </div>
              {t.service_charge > 0 && (
                <div className="flex justify-between text-muted">
                  <dt>Service charge</dt>
                  <dd className="num">{rupee(t.service_charge)}</dd>
                </div>
              )}
              <div className="flex justify-between text-muted">
                <dt>GST ({menu?.tax.gst_percent ?? 0}%)</dt>
                <dd className="num">{rupee(t.tax)}</dd>
              </div>
              <div className="flex justify-between text-[17px] font-bold">
                <dt>Total</dt>
                <dd className="num">{rupee(t.total)}</dd>
              </div>
            </dl>
            {blocked ? (
              <p className="rounded-xl bg-danger-soft px-3 py-2 text-[13.5px] text-danger">Remove the items marked unavailable to continue.</p>
            ) : (
              <Link href="/checkout" onClick={() => setOpen(false)} className="flex min-h-[52px] w-full items-center justify-center rounded-full bg-primary text-[16px] font-semibold text-primary-fg hover:bg-primary-hover">
                {mode === "dine_in" && table ? `Checkout · Table ${table.label}` : "Checkout"}
              </Link>
            )}
          </div>
        )
      }
    >
      {!count ? (
        <div className="px-6 py-16 text-center">
          <ShoppingBag size={28} className="mx-auto text-muted" aria-hidden />
          <p className="mt-3 text-[16px] font-semibold">Your order is empty</p>
          <p className="mt-1 text-[14px] text-muted">Add something from the menu to get started.</p>
          <Link href="/menu" onClick={() => setOpen(false)} className="mt-5 inline-flex min-h-[48px] items-center rounded-full border border-line px-6 font-semibold hover:border-line-strong">
            Browse the menu
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {lines.map((l) => {
            const item = menu ? itemById(menu, l.line.item_id) : undefined;
            return (
              <li key={l.line.key} className="flex gap-3 px-5 py-4">
                <button type="button" className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-surface-2" onClick={() => item && l.ok && (setOpen(false), openItem(item, l.line))} aria-label={`Edit ${l.name}`} disabled={!item || !l.ok}>
                  {item && <ItemVisual item={item} keys={menu ? visualKeys(menu, item, l.line.modifier_ids) : []} className="h-full w-full p-1" />}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold leading-snug">{l.name}</p>
                    <p className="num shrink-0 font-semibold">{l.ok ? rupee(l.total) : ""}</p>
                  </div>
                  {l.detail && <p className="mt-0.5 text-[13px] text-muted">{l.detail}</p>}
                  {l.line.notes && <p className="mt-0.5 text-[13px] italic text-muted">“{l.line.notes}”</p>}
                  {!l.ok && (
                    <p className="mt-1 flex items-center gap-1 text-[13px] font-semibold text-danger">
                      <AlertCircle size={14} aria-hidden /> {l.error}
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    {l.ok ? (
                      <Stepper size="sm" value={l.line.qty} onChange={(v) => setQty(l.line.key, v)} label={l.name} />
                    ) : (
                      <ShopButton variant="secondary" className="min-h-[36px] px-3 text-[13px]" onClick={() => setQty(l.line.key, 0)}>
                        <Trash2 size={14} /> Remove
                      </ShopButton>
                    )}
                    {l.ok && item && (
                      <button type="button" className="text-[13px] font-semibold text-primary hover:underline" onClick={() => (setOpen(false), openItem(item, l.line))}>
                        Edit
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Sheet>
  );
}
