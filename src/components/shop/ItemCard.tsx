"use client";

import { Plus } from "lucide-react";
import { defaultSelection, fromPrice, isBuilder, useMenu, visualKeys, type ShopItem, type ShopMenu } from "@/lib/shop/menu";
import { useShop } from "@/lib/shop/store";
import { DietMark, ShopButton, Spinner, rupee, toast } from "./ui";
import { ItemVisual } from "./ItemVisual";
import { useOpenItem } from "./ItemSheet";
import { clsx } from "@/lib/clsx";

export function ItemCard({ menu, item, layout = "row" }: { menu: ShopMenu; item: ShopItem; layout?: "row" | "tile" }) {
  const open = useOpenItem();
  const add = useShop((s) => s.add);
  const soldOut = item.status !== "available";
  const configurable = isBuilder(item) || item.variants.length > 1 || item.group_ids.length > 0;
  const keys = isBuilder(item) ? visualKeys(menu, item, defaultSelection(menu, item).modifier_ids) : undefined;

  const quickAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (configurable) return open(item);
    const d = defaultSelection(menu, item);
    add({ item_id: item.id, variant_id: d.variant_id, modifier_ids: d.modifier_ids, qty: 1 });
    toast(`${item.name} added`);
  };

  const price = (
    <span className="num text-[15px] font-bold">
      {item.variants.length > 1 && <span className="text-[12.5px] font-normal text-muted">from </span>}
      {rupee(fromPrice(item))}
    </span>
  );
  const button = soldOut ? (
    <span className="rounded-full bg-surface-2 px-3 py-1.5 text-[12.5px] font-semibold text-muted">Sold out</span>
  ) : (
    <button type="button" onClick={quickAdd} className="inline-flex h-9 items-center gap-1 rounded-full border border-primary px-3.5 text-[13.5px] font-semibold text-primary hover:bg-primary hover:text-primary-fg" aria-label={`${configurable ? "Choose options for" : "Add"} ${item.name}`}>
      <Plus size={15} aria-hidden /> {isBuilder(item) ? "Build" : "Add"}
    </button>
  );

  if (layout === "tile") {
    return (
      <article className={clsx("group flex flex-col overflow-hidden rounded-3xl border border-line bg-surface transition-colors hover:border-line-strong", soldOut && "opacity-70")}>
        <button type="button" onClick={() => open(item)} className="block text-left" aria-label={`${item.name}, ${rupee(fromPrice(item))}`}>
          <div className="aspect-[5/4] bg-surface-2">
            <ItemVisual item={item} keys={keys} className="h-full w-full p-3" />
          </div>
        </button>
        <div className="flex flex-1 flex-col p-4">
          <h3 className="flex items-start gap-2 text-[16px] font-bold leading-snug">
            <DietMark diet={item.diet} className="mt-1" />
            {item.name}
          </h3>
          <p className="mt-1 line-clamp-2 text-[13.5px] text-muted">{item.description}</p>
          <div className="mt-auto flex items-center justify-between pt-3">
            {price}
            {button}
          </div>
        </div>
      </article>
    );
  }
  return (
    <article className={clsx("flex gap-3 rounded-2xl border border-line bg-surface p-3 transition-colors hover:border-line-strong", soldOut && "opacity-70")}>
      <button type="button" onClick={() => open(item)} className="flex min-w-0 flex-1 gap-3 text-left" aria-label={`${item.name}, ${rupee(fromPrice(item))}${soldOut ? ", sold out" : ""}`}>
        <div className="h-[92px] w-[92px] shrink-0 overflow-hidden rounded-xl bg-surface-2">
          <ItemVisual item={item} keys={keys} className="h-full w-full p-1.5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="flex items-start gap-2 text-[15.5px] font-bold leading-snug">
            <DietMark diet={item.diet} className="mt-1" />
            {item.name}
          </h3>
          <p className="mt-0.5 line-clamp-2 text-[13px] text-muted">{item.description}</p>
          <p className="mt-1.5">{price}</p>
        </div>
      </button>
      <div className="flex shrink-0 items-end">{button}</div>
    </article>
  );
}

export function MenuGate({ children }: { children: (menu: ShopMenu) => React.ReactNode }) {
  const menu = useMenu((s) => s.menu);
  const error = useMenu((s) => s.error);
  const load = useMenu((s) => s.load);
  if (menu) return <>{children(menu)}</>;
  if (error)
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <p className="text-[17px] font-semibold">We couldn&apos;t load the menu</p>
        <p className="mt-1 text-muted">{error}</p>
        <ShopButton className="mt-5" onClick={() => load(true)}>
          Try again
        </ShopButton>
      </div>
    );
  return (
    <div className="grid place-items-center py-24 text-muted" aria-busy="true">
      <Spinner />
      <span className="sr-only">Loading the menu…</span>
    </div>
  );
}
