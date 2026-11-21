"use client";

import Link from "next/link";
import { ArrowRight, Gift, QrCode, ShoppingBag, Sparkles } from "lucide-react";
import { MenuGate, ItemCard } from "@/components/shop/ItemCard";
import { ItemVisual } from "@/components/shop/ItemVisual";
import { useContextSheet } from "@/components/shop/ContextSheet";
import { useOpenItem } from "@/components/shop/ItemSheet";
import { rupee } from "@/components/shop/ui";
import { defaultSelection, fromPrice, isBuilder, visualKeys, type ShopMenu } from "@/lib/shop/menu";
import { useShop, useShopHydrated } from "@/lib/shop/store";
import { useAccount } from "@/lib/shop/account";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

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
  const builders = menu.items.filter((i) => isBuilder(i) && i.status === "available");
  const bowl = builders.find((i) => i.visual === "bowl");
  const shake = builders.find((i) => i.visual === "glass");
  const first = account?.customer.name.split(" ")[0];

  return (
    <div className="space-y-10 md:space-y-14">
      {/* welcome */}
      <section className="grid items-center gap-6 rounded-[28px] border border-line bg-surface p-5 md:grid-cols-[1.1fr_1fr] md:p-10">
        <div>
          <p className="eyebrow">{menu.business.name}</p>
          <h1 className="mt-2 font-display text-[38px] font-semibold leading-[1.05] md:text-[56px]">
            {greeting()}
            {first ? `, ${first}` : ""}.
          </h1>
          <p className="mt-3 max-w-md text-[16px] text-muted">{menu.business.tagline || "Wholesome bowls, thick shakes, chaat and café classics — made fresh, exactly how you like them."}</p>
          {hydrated && (
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link href="/menu" className="inline-flex min-h-[52px] items-center gap-2 rounded-full bg-primary px-7 text-[16px] font-semibold text-primary-fg hover:bg-primary-hover">
                {mode === "dine_in" && table ? `Order for Table ${table.label}` : "See the menu"} <ArrowRight size={18} aria-hidden />
              </Link>
              {!mode && (
                <button type="button" onClick={() => openContext(true)} className="inline-flex min-h-[52px] items-center gap-2 rounded-full border border-line px-6 text-[15px] font-semibold hover:border-line-strong">
                  <QrCode size={17} aria-hidden /> At a table? <span className="text-muted">/</span> <ShoppingBag size={17} aria-hidden /> Takeaway
                </button>
              )}
            </div>
          )}
          {account && (
            <Link href="/rewards" className="mt-5 inline-flex items-center gap-2 rounded-full bg-accent-soft px-4 py-2 text-[14px] font-semibold text-accent-text">
              <Gift size={16} aria-hidden /> {account.points.balance.toLocaleString("en-IN")} points · worth {rupee(account.points.value)}
            </Link>
          )}
        </div>
        {bowl && (
          <button type="button" onClick={() => openItem(bowl)} className="mx-auto block w-full max-w-[420px]" aria-label={`Build ${bowl.name}`}>
            <ItemVisual item={bowl} keys={visualKeys(menu, bowl, defaultSelection(menu, bowl).modifier_ids)} animate className="aspect-square w-full" />
          </button>
        )}
      </section>

      {/* categories */}
      <section aria-labelledby="cat-h">
        <h2 id="cat-h" className="mb-3 text-[20px] font-bold">
          What are you in the mood for?
        </h2>
        <ul className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
          {menu.categories.map((c) => {
            const n = menu.items.filter((i) => i.category_id === c.id).length;
            if (!n) return null;
            return (
              <li key={c.id} className="shrink-0">
                <Link href={`/menu#${c.slug}`} className="flex h-11 items-center gap-2 rounded-full border border-line bg-surface px-4 text-[14.5px] font-semibold hover:border-line-strong">
                  {c.name}
                  <span className="text-[12.5px] font-normal text-muted">{n}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {/* build your own */}
      {(bowl || shake) && (
        <section aria-labelledby="build-h" className="grid gap-4 md:grid-cols-2">
          <h2 id="build-h" className="sr-only">
            Build your own
          </h2>
          {[bowl, shake].filter(Boolean).map((it) => (
            <button key={it!.id} type="button" onClick={() => openItem(it!)} className="flex items-center gap-4 rounded-3xl border border-line bg-surface p-4 text-left hover:border-line-strong">
              <span className="h-28 w-28 shrink-0 overflow-hidden rounded-2xl bg-surface-2">
                <ItemVisual item={it!} keys={visualKeys(menu, it!, defaultSelection(menu, it!).modifier_ids)} className="h-full w-full" />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-[12.5px] font-bold uppercase tracking-wide text-accent-text">
                  <Sparkles size={14} aria-hidden /> Build your own
                </span>
                <span className="mt-1 block text-[18px] font-bold">{it!.visual === "bowl" ? "Oats bowl, your way" : "Thick shake, your way"}</span>
                <span className="mt-0.5 block text-[14px] text-muted">
                  Pick the base, fruit, toppings and protein — see it come together. From {rupee(fromPrice(it!))}.
                </span>
              </span>
            </button>
          ))}
        </section>
      )}

      {/* popular */}
      {featured.length > 0 && (
        <section aria-labelledby="pop-h">
          <div className="mb-3 flex items-end justify-between">
            <h2 id="pop-h" className="text-[20px] font-bold">
              Guest favourites
            </h2>
            <Link href="/menu" className="text-[14px] font-semibold text-primary hover:underline">
              Full menu
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((i) => (
              <ItemCard key={i.id} menu={menu} item={i} layout="tile" />
            ))}
          </div>
        </section>
      )}

      {/* rewards */}
      {menu.loyalty.enabled && !account && (
        <section className="flex flex-col items-start gap-4 rounded-3xl border border-line bg-accent-soft/60 p-6 md:flex-row md:items-center">
          <Gift size={28} className="text-accent-text" aria-hidden />
          <div className="flex-1">
            <h2 className="text-[18px] font-bold">Earn points on every order</h2>
            <p className="mt-0.5 text-[14.5px] text-muted">
              {menu.loyalty.points_per_100} points for every ₹100 — spend them on free drinks and treats. Joining takes a minute with your mobile number.
            </p>
          </div>
          <Link href="/rewards" className="inline-flex min-h-[48px] items-center rounded-full bg-primary px-6 font-semibold text-primary-fg hover:bg-primary-hover">
            Join rewards
          </Link>
        </section>
      )}
    </div>
  );
}
