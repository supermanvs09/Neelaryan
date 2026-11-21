"use client";

import { Plus } from "lucide-react";
import { defaultSelection, fromPrice, isBuilder, itemOffer, useMenu, type ShopItem, type ShopMenu } from "@/lib/shop/menu";
import { useT } from "@/lib/shop/i18n";
import { useShop } from "@/lib/shop/store";
import { DietMark, ShopButton, Spinner, rupee, toast } from "./ui";
import { ItemVisual } from "./ItemVisual";
import { useOpenItem } from "./ItemSheet";
import { clsx } from "@/lib/clsx";

export function ItemCard({ menu, item, layout = "row" }: { menu: ShopMenu; item: ShopItem; layout?: "row" | "tile" }) {
  const open = useOpenItem();
  const t = useT();
  const add = useShop((s) => s.add);
  const deal = itemOffer(menu, item);
  const fewLeft = item.stock_left !== null && item.stock_left > 0 && item.stock_left <= 5;
  const soldOut = item.status !== "available";
  const configurable = isBuilder(item) || item.variants.length > 1 || item.group_ids.length > 0;

  const quickAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (configurable) return open(item);
    const d = defaultSelection(menu, item);
    add({ item_id: item.id, variant_id: d.variant_id, modifier_ids: d.modifier_ids, qty: 1 });
    toast(t("item.added", { qty: 1, name: item.name }));
  };

  const price = (
    <span className="flex flex-wrap items-baseline gap-x-1.5">
      <span className="num text-[15px] font-bold">
        {item.variants.length > 1 && <span className="text-[12.5px] font-normal text-muted">{t("menu.from")} </span>}
        {rupee(deal ? deal.price : fromPrice(item))}
      </span>
      {deal && <span className="num text-[13px] text-muted line-through">{rupee(deal.was)}</span>}
      {deal && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11.5px] font-bold text-accent-text">{t("menu.off", { pct: deal.offer.percent_off })}</span>}
      {fewLeft && !soldOut && <span className="text-[12px] font-semibold text-warning">{t("menu.left", { n: item.stock_left! })}</span>}
    </span>
  );
  const button = soldOut ? (
    <span className="rounded-full bg-surface-2 px-3 py-1.5 text-[12.5px] font-semibold text-muted">{t("menu.soldOut")}</span>
  ) : (
    <button type="button" onClick={quickAdd} className="inline-flex h-9 items-center gap-1 rounded-full border border-primary px-4 text-[13.5px] font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-fg" aria-label={`${configurable ? "Choose options for" : "Add"} ${item.name}`}>
      <Plus size={15} aria-hidden /> {isBuilder(item) ? t("menu.build") : t("menu.add")}
    </button>
  );

  if (layout === "tile") {
    return (
      <article className={clsx("group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-card transition-colors hover:border-accent", soldOut && "opacity-70")}>
        <button type="button" onClick={() => open(item)} className="block text-left" aria-label={`${item.name}, ${rupee(fromPrice(item))}`}>
          <div className="aspect-[16/9] bg-surface-2">
            <ItemVisual item={item} iconSize={36} />
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
    <article className={clsx("flex gap-3 rounded-2xl border border-line bg-surface p-3 shadow-card transition-colors hover:border-accent", soldOut && "opacity-70")}>
      <button type="button" onClick={() => open(item)} className="flex min-w-0 flex-1 gap-3 text-left" aria-label={`${item.name}, ${rupee(fromPrice(item))}${soldOut ? ", sold out" : ""}`}>
        <div className="h-[76px] w-[76px] shrink-0 overflow-hidden rounded-xl bg-surface-2">
          <ItemVisual item={item} />
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
  const t = useT();
  const menu = useMenu((s) => s.menu);
  const error = useMenu((s) => s.error);
  const load = useMenu((s) => s.load);
  if (menu) return <>{children(menu)}</>;
  if (error)
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <p className="text-[17px] font-semibold">{t("menu.loadFailed")}</p>
        <p className="mt-1 text-muted">{error}</p>
        <ShopButton className="mt-5" onClick={() => load(true)}>
          {t("menu.retry")}
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
