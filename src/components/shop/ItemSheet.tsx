"use client";

import { useState } from "react";
import { create } from "zustand";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { useMenu, itemBySlug, isBuilder, type ShopItem, type ShopMenu } from "@/lib/shop/menu";
import { useShop, type CartLine } from "@/lib/shop/store";
import { DietMark, Sheet, ShopButton, Stepper, rupee, toast } from "./ui";
import { ItemVisual } from "./ItemVisual";
import { groupTitle, optionDelta, useSelection } from "./selection";
import { clsx } from "@/lib/clsx";

interface SheetState {
  slug: string | null;
  edit: CartLine | null;
  open: (slug: string, edit?: CartLine | null) => void;
  close: () => void;
}
export const useItemSheet = create<SheetState>((set) => ({ slug: null, edit: null, open: (slug, edit = null) => set({ slug, edit }), close: () => set({ slug: null, edit: null }) }));

/** Opens an item: builder dishes get the full-screen builder, everything else this sheet. */
export function useOpenItem() {
  const router = useRouter();
  const open = useItemSheet((s) => s.open);
  return (item: ShopItem, edit?: CartLine | null) => {
    if (isBuilder(item)) router.push(`/build/${item.slug}${edit ? `?edit=${encodeURIComponent(edit.key)}` : ""}`);
    else open(item.slug, edit);
  };
}

export function ItemSheet() {
  const menu = useMenu((s) => s.menu);
  const { slug, edit, close } = useItemSheet();
  const item = menu && slug ? itemBySlug(menu, slug) : null;
  return (
    <Sheet open={!!item} onClose={close} title={item?.name}>
      {item && menu && <Configurator key={`${item.id}-${edit?.key ?? ""}`} menu={menu} item={item} edit={edit} onDone={close} />}
    </Sheet>
  );
}

function Configurator({ menu, item, edit, onDone }: { menu: ShopMenu; item: ShopItem; edit: CartLine | null; onDone: () => void }) {
  const sel = useSelection(menu, item, edit ? { variant_id: edit.variant_id, modifier_ids: edit.modifier_ids } : undefined);
  const [qty, setQty] = useState(edit?.qty ?? 1);
  const [notes, setNotes] = useState(edit?.notes ?? "");
  const add = useShop((s) => s.add);
  const replace = useShop((s) => s.replace);
  const p = sel.price(qty);
  const soldOut = item.status !== "available";

  const submit = () => {
    if (!p.ok) return;
    const line = { item_id: item.id, variant_id: sel.variant, modifier_ids: sel.mods, qty, notes: notes.trim() || undefined };
    if (edit) replace(edit.key, line);
    else add(line);
    toast(edit ? "Updated" : `${qty} × ${item.name} added`);
    onDone();
  };

  return (
    <div className="flex min-h-full flex-col">
      <div className="px-5 pt-4">
        {item.image && (
          <div className="mb-4 aspect-[16/9] w-full overflow-hidden rounded-xl bg-surface-2">
            <ItemVisual item={item} />
          </div>
        )}
        <div className="flex items-start gap-2">
          <DietMark diet={item.diet} className="mt-1" />
          <p className="text-[14.5px] text-muted">{item.description}</p>
        </div>
      </div>

      <div className="space-y-6 px-5 py-5">
        {item.variants.length > 1 && (
          <fieldset>
            <legend className="mb-2 text-[15px] font-bold">Size</legend>
            <div className="grid grid-cols-2 gap-2">
              {item.variants.map((v) => (
                <Choice key={v.id} on={sel.variant === v.id} label={v.name} price={rupee(v.price)} onClick={() => sel.setVariant(v.id)} radio />
              ))}
            </div>
          </fieldset>
        )}
        {sel.groups.map((g) => {
          const count = g.modifiers.filter((m) => sel.mods.includes(m.id)).length;
          return (
            <fieldset key={g.id}>
              <legend className="mb-2 flex w-full items-baseline justify-between text-[15px] font-bold">
                {groupTitle(g)}
                <span className="text-[12.5px] font-normal text-muted">{g.selection === "single" ? "Choose one" : g.max_select ? `Up to ${g.max_select}${count ? ` · ${count} chosen` : ""}` : "Optional"}</span>
              </legend>
              <div className="grid grid-cols-2 gap-2">
                {g.modifiers.map((m) => {
                  const d = optionDelta(item, g, m.id);
                  const incl = g.selection === "multi" && item.default_modifier_ids.includes(m.id);
                  return <Choice key={m.id} on={sel.mods.includes(m.id)} label={m.name} price={incl ? "Included" : d ? `+${rupee(d)}` : ""} radio={g.selection === "single"} onClick={() => sel.toggle(g, m.id)} />;
                })}
              </div>
            </fieldset>
          );
        })}
        {sel.limitHit && <p className="rounded-xl bg-warning-soft px-3 py-2 text-[13.5px] text-warning">{sel.limitHit}</p>}
        <label className="block">
          <span className="mb-1.5 block text-[15px] font-bold">
            Anything we should know? <span className="font-normal text-muted">(optional)</span>
          </span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={140} rows={2} placeholder="Less spicy, no onion, extra hot…" className="field-input w-full resize-none" />
        </label>
      </div>

      <div className="sticky bottom-0 mt-auto flex items-center gap-3 border-t border-line bg-surface px-5 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
        <Stepper value={qty} onChange={(v) => setQty(Math.max(1, v))} min={1} max={50} label="quantity" />
        <ShopButton className="flex-1" onClick={submit} disabled={!p.ok || soldOut}>
          {soldOut ? "Sold out right now" : !p.ok ? p.error : `${edit ? "Update" : "Add"} · ${rupee(p.lineTotal)}`}
        </ShopButton>
      </div>
    </div>
  );
}

export function Choice({ on, label, price, onClick, radio }: { on: boolean; label: string; price?: string; onClick: () => void; radio?: boolean }) {
  return (
    <button
      type="button"
      role={radio ? "radio" : "checkbox"}
      aria-checked={on}
      onClick={onClick}
      className={clsx("flex min-h-[52px] items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-[14px] transition-colors", on ? "border-primary bg-primary-soft font-semibold" : "border-line bg-surface hover:border-line-strong")}
    >
      <span className={clsx("grid h-5 w-5 shrink-0 place-items-center border-2", radio ? "rounded-full" : "rounded-md", on ? "border-primary bg-primary text-primary-fg" : "border-line-strong")} aria-hidden>
        {on && (radio ? <span className="h-2 w-2 rounded-full bg-primary-fg" /> : <Check size={13} strokeWidth={3} />)}
      </span>
      <span className="min-w-0 flex-1">{label}</span>
      {price && <span className="num shrink-0 text-[12.5px] font-normal text-muted">{price}</span>}
    </button>
  );
}
