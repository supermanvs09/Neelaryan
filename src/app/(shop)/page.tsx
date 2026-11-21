"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight, Clock, Gift, QrCode, ReceiptText, RotateCcw, ShoppingBag, SlidersHorizontal, UtensilsCrossed } from "lucide-react";
import { MenuGate, ItemCard } from "@/components/shop/ItemCard";
import { useContextSheet } from "@/components/shop/ContextSheet";
import { useOpenItem } from "@/components/shop/ItemSheet";
import { useCartSheet } from "@/components/shop/CartSheet";
import { useEta } from "@/components/shop/useEta";
import { reorder, type PastItem } from "@/components/shop/reorder";
import { ShopButton, rupee, toast } from "@/components/shop/ui";
import { fromPrice, isBuilder, type ShopMenu } from "@/lib/shop/menu";
import { useShop, useShopHydrated } from "@/lib/shop/store";
import { useAccount } from "@/lib/shop/account";
import { useT } from "@/lib/shop/i18n";

export default function HomePage() {
  return <MenuGate>{(menu) => <Home menu={menu} />}</MenuGate>;
}

function Home({ menu }: { menu: ShopMenu }) {
  const t = useT();
  const hydrated = useShopHydrated();
  const mode = useShop((s) => s.mode);
  const table = useShop((s) => s.table);
  const account = useAccount((s) => s.data);
  const openContext = useContextSheet((s) => s.set);
  const openItem = useOpenItem();
  const eta = useEta(menu.ordering.show_wait_time && menu.ordering.accepting_orders);
  const featured = menu.items.filter((i) => i.is_featured && i.status === "available" && !isBuilder(i)).slice(0, 6);
  const builders = [menu.items.find((i) => i.visual === "bowl" && i.status === "available"), menu.items.find((i) => i.visual === "glass" && i.status === "available")].filter(Boolean) as ShopMenu["items"];

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-5">
        <div>
          <h1 className="text-[26px] font-bold md:text-[30px]">{menu.business.name}</h1>
          <p className="mt-0.5 text-[15px] text-muted">{menu.business.tagline}</p>
          {eta && (
            <p className="mt-2 inline-flex items-center gap-1.5 text-[13.5px] font-semibold">
              <Clock size={15} className="text-primary" aria-hidden /> {t(eta.busy ? "eta.busy" : "eta.quiet", { min: eta.minutes })}
            </p>
          )}
        </div>
        <Link href="/menu" className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-primary px-5 text-[15px] font-semibold text-primary-fg hover:bg-primary-hover">
          <UtensilsCrossed size={17} aria-hidden /> {t("home.view")}
        </Link>
      </header>

      <section className="grid gap-3 md:grid-cols-3" aria-label={t("cart.title")}>
        <button type="button" onClick={() => openContext(true)} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4 text-left hover:border-line-strong">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">{mode === "takeaway" ? <ShoppingBag size={19} aria-hidden /> : <QrCode size={19} aria-hidden />}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] text-muted">{t("home.orderingFor")}</span>
            <span className="block font-semibold">{!hydrated ? "…" : mode === "dine_in" && table ? t("ctx.table", { table: table.label }) : mode === "takeaway" ? t("ctx.takeaway") : t("home.chooseCtx")}</span>
          </span>
          <ChevronRight size={18} className="text-muted" aria-hidden />
        </button>
        <Link href="/orders" className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4 hover:border-line-strong">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
            <ReceiptText size={19} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] text-muted">{t("nav.orders")}</span>
            <span className="block font-semibold">{t("home.track")}</span>
          </span>
          <ChevronRight size={18} className="text-muted" aria-hidden />
        </Link>
        {menu.loyalty.enabled && (
          <Link href="/rewards" className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4 hover:border-line-strong">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent-text">
              <Gift size={19} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] text-muted">{t("nav.rewards")}</span>
              <span className="block font-semibold">{account ? `${account.points.balance.toLocaleString("en-IN")} · ${rupee(account.points.value)}` : t("home.earn", { points: menu.loyalty.points_per_100 })}</span>
            </span>
            <ChevronRight size={18} className="text-muted" aria-hidden />
          </Link>
        )}
      </section>

      {hydrated && <LastOrder menu={menu} />}

      <section aria-labelledby="cat-h">
        <h2 id="cat-h" className="mb-3 text-[17px] font-bold">
          {t("home.categories")}
        </h2>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {menu.categories.map((c) => {
            const n = menu.items.filter((i) => i.category_id === c.id).length;
            if (!n) return null;
            return (
              <li key={c.id}>
                <Link href={`/menu#${c.slug}`} className="flex h-full items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3.5 py-3 text-[14.5px] font-semibold hover:border-line-strong">
                  <span className="min-w-0">{c.name}</span>
                  <span className="num shrink-0 text-[12.5px] font-normal text-muted">{n}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {builders.length > 0 && (
        <section aria-labelledby="build-h">
          <h2 id="build-h" className="mb-3 text-[17px] font-bold">
            {t("home.yourWay")}
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {builders.map((it) => (
              <button key={it.id} type="button" onClick={() => openItem(it)} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4 text-left hover:border-line-strong">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted">
                  <SlidersHorizontal size={19} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{t(it.visual === "bowl" ? "home.buildBowl" : "home.buildShake")}</span>
                  <span className="block text-[13.5px] text-muted">{t("home.buildHint", { price: rupee(fromPrice(it)) })}</span>
                </span>
                <ChevronRight size={18} className="text-muted" aria-hidden />
              </button>
            ))}
          </div>
        </section>
      )}

      {featured.length > 0 && (
        <section aria-labelledby="pop-h">
          <div className="mb-3 flex items-end justify-between">
            <h2 id="pop-h" className="text-[17px] font-bold">
              {t("home.popular")}
            </h2>
            <Link href="/menu" className="text-[14px] font-semibold text-primary hover:underline">
              {t("home.fullMenu")}
            </Link>
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {featured.map((i) => (
              <ItemCard key={i.id} menu={menu} item={i} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/** "Your last order" with one-tap Order again (orders placed on this phone). */
function LastOrder({ menu }: { menu: ShopMenu }) {
  const t = useT();
  const last = useShop((s) => s.orders[0]);
  const openCart = useCartSheet((s) => s.set);
  const [order, setOrder] = useState<{ number: number; status: string; items: (PastItem & { name: string })[] } | null>(null);
  useEffect(() => {
    if (!last) return;
    fetch(`/api/public/orders/${last.id}`, { headers: { "x-order-token": last.token }, cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setOrder(j.order))
      .catch(() => undefined);
  }, [last]);
  if (!order || !["served", "completed"].includes(order.status) || !order.items.some((i) => i.menu_item_id)) return null;
  const again = () => {
    const r = reorder(menu, order.items);
    if (!r.added) return toast(t("again.none"), "warn");
    toast(r.skipped ? t("again.partial", { n: r.skipped }) : t("again.added"), r.skipped ? "warn" : "ok");
    openCart(true);
  };
  return (
    <section className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-4">
      <div className="min-w-0 flex-1">
        <p className="text-[13px] text-muted">
          {t("home.lastOrder")} · #{order.number}
        </p>
        <p className="truncate font-semibold">{order.items.map((i) => `${i.qty} × ${i.name}`).join(", ")}</p>
      </div>
      <ShopButton variant="secondary" onClick={again}>
        <RotateCcw size={16} /> {t("trk.again")}
      </ShopButton>
    </section>
  );
}
