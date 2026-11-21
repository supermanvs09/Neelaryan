"use client";

import Link from "next/link";
import { ChevronRight, Gift, QrCode, ReceiptText, ShoppingBag, SlidersHorizontal, UtensilsCrossed } from "lucide-react";
import { MenuGate, ItemCard } from "@/components/shop/ItemCard";
import { useContextSheet } from "@/components/shop/ContextSheet";
import { useOpenItem } from "@/components/shop/ItemSheet";
import { rupee } from "@/components/shop/ui";
import { fromPrice, isBuilder, type ShopMenu } from "@/lib/shop/menu";
import { useShop, useShopHydrated } from "@/lib/shop/store";
import { useAccount } from "@/lib/shop/account";

export default function HomePage() {
  return <MenuGate>{(menu) => <Home menu={menu} />}</MenuGate>;
}

function Home({ menu }: { menu: ShopMenu }) {
  const hydrated = useShopHydrated();
  const mode = useShop((s) => s.mode);
  const table = useShop((s) => s.table);
  const account = useAccount((s) => s.data);
  const openContext = useContextSheet((s) => s.set);
  const openItem = useOpenItem();
  const featured = menu.items.filter((i) => i.is_featured && i.status === "available" && !isBuilder(i)).slice(0, 6);
  const builders = [menu.items.find((i) => i.visual === "bowl" && i.status === "available"), menu.items.find((i) => i.visual === "glass" && i.status === "available")].filter(Boolean) as ShopMenu["items"];

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-5">
        <div>
          <h1 className="text-[26px] font-bold md:text-[30px]">{menu.business.name}</h1>
          <p className="mt-0.5 text-[15px] text-muted">{menu.business.tagline || "Order from your table or for takeaway."}</p>
        </div>
        <Link href="/menu" className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-primary px-5 text-[15px] font-semibold text-primary-fg hover:bg-primary-hover">
          <UtensilsCrossed size={17} aria-hidden /> View menu
        </Link>
      </header>

      {/* ordering context + quick links */}
      <section className="grid gap-3 md:grid-cols-3" aria-label="Your order">
        <button type="button" onClick={() => openContext(true)} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4 text-left hover:border-line-strong">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">{mode === "takeaway" ? <ShoppingBag size={19} aria-hidden /> : <QrCode size={19} aria-hidden />}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] text-muted">Ordering for</span>
            <span className="block font-semibold">{!hydrated ? "…" : mode === "dine_in" && table ? `Table ${table.label}` : mode === "takeaway" ? "Takeaway" : "Choose table or takeaway"}</span>
          </span>
          <ChevronRight size={18} className="text-muted" aria-hidden />
        </button>
        <Link href="/orders" className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4 hover:border-line-strong">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
            <ReceiptText size={19} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] text-muted">Orders</span>
            <span className="block font-semibold">Track your orders</span>
          </span>
          <ChevronRight size={18} className="text-muted" aria-hidden />
        </Link>
        {menu.loyalty.enabled && (
          <Link href="/rewards" className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4 hover:border-line-strong">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent-text">
              <Gift size={19} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] text-muted">Rewards</span>
              <span className="block font-semibold">{account ? `${account.points.balance.toLocaleString("en-IN")} points · ${rupee(account.points.value)}` : `Earn ${menu.loyalty.points_per_100} points per ₹100`}</span>
            </span>
            <ChevronRight size={18} className="text-muted" aria-hidden />
          </Link>
        )}
      </section>

      {/* categories */}
      <section aria-labelledby="cat-h">
        <h2 id="cat-h" className="mb-3 text-[17px] font-bold">
          Categories
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
            Make it your way
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {builders.map((it) => (
              <button key={it.id} type="button" onClick={() => openItem(it)} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4 text-left hover:border-line-strong">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted">
                  <SlidersHorizontal size={19} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{it.visual === "bowl" ? "Build your oats bowl" : "Build your shake"}</span>
                  <span className="block text-[13.5px] text-muted">Choose base, fruit, toppings and protein · from {rupee(fromPrice(it))}</span>
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
              Popular
            </h2>
            <Link href="/menu" className="text-[14px] font-semibold text-primary hover:underline">
              Full menu
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
