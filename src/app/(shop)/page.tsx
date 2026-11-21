"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronRight, Clock, Gift, QrCode, ReceiptText, RotateCcw, ShoppingBag, SlidersHorizontal, UtensilsCrossed } from "lucide-react";
import { MenuGate, ItemCard } from "@/components/shop/ItemCard";
import { useContextSheet } from "@/components/shop/ContextSheet";
import { useOpenItem } from "@/components/shop/ItemSheet";
import { useCartSheet } from "@/components/shop/CartSheet";
import { useEta } from "@/components/shop/useEta";
import { reorder, type PastItem } from "@/components/shop/reorder";
import { ShopButton, rupee, toast } from "@/components/shop/ui";
import { ProductImage } from "@/components/ProductImage";
import { brandName } from "@/lib/shop/brand";
import { fromPrice, isBuilder, type ShopMenu } from "@/lib/shop/menu";
import { useShop, useShopHydrated } from "@/lib/shop/store";
import { useAccount } from "@/lib/shop/account";
import { useT } from "@/lib/shop/i18n";
import { LanguageSwitch } from "@/components/shop/ShopShell";

export default function HomePage() {
  return <MenuGate>{(menu) => <Home menu={menu} />}</MenuGate>;
}

function Home({ menu }: { menu: ShopMenu }) {
  const t = useT();
  const hydrated = useShopHydrated();
  const account = useAccount((s) => s.data);
  const openItem = useOpenItem();
  const eta = useEta(menu.ordering.show_wait_time && menu.ordering.accepting_orders);
  const featured = menu.items.filter((i) => i.is_featured && i.status === "available" && !isBuilder(i)).slice(0, 6);
  const builders = [menu.items.find((i) => i.visual === "bowl" && i.status === "available"), menu.items.find((i) => i.visual === "glass" && i.status === "available")].filter(Boolean) as ShopMenu["items"];

  return (
    <div className="space-y-8 md:space-y-10">
      <Hero menu={menu} eta={eta} />

      <section className="grid gap-3 md:grid-cols-2" aria-label={t("nav.orders")}>
        <Link href="/orders" className="group flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card transition-colors hover:border-accent">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
            <ReceiptText size={19} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] text-muted">{t("nav.orders")}</span>
            <span className="block font-semibold">{t("home.track")}</span>
          </span>
          <ChevronRight size={18} className="text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>
        {menu.loyalty.enabled && (
          <Link href="/rewards" className="group flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card transition-colors hover:border-accent">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-text">
              <Gift size={19} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] text-muted">{t("nav.rewards")}</span>
              <span className="block font-semibold">{account ? `${account.points.balance.toLocaleString("en-IN")} pts · ${rupee(account.points.value)}` : t("home.earn", { points: menu.loyalty.points_per_100 })}</span>
            </span>
            <ChevronRight size={18} className="text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        )}
      </section>

      {hydrated && <LastOrder menu={menu} />}

      <section aria-labelledby="cat-h">
        <h2 id="cat-h" className="section-title mb-4">
          {t("home.categories")}
        </h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {menu.categories.map((c) => {
            const n = menu.items.filter((i) => i.category_id === c.id).length;
            if (!n) return null;
            return (
              <li key={c.id}>
                <Link href={`/menu#${c.slug}`} className="group flex h-full items-center gap-3 rounded-2xl border border-line bg-surface p-3 shadow-card transition-colors hover:border-accent">
                  <span className="h-11 w-11 shrink-0 overflow-hidden rounded-xl">
                    <ProductImage image={null} kind={c.art_kind} name="" iconSize={20} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[14px] font-semibold leading-snug">{c.name}</span>
                    <span className="num block text-[12.5px] text-muted">{n}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {builders.length > 0 && (
        <section aria-labelledby="build-h">
          <h2 id="build-h" className="section-title mb-4">
            {t("home.yourWay")}
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {builders.map((it) => (
              <button key={it.id} type="button" onClick={() => openItem(it)} className="group flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 text-left shadow-card transition-colors hover:border-accent">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-text">
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
          <div className="mb-4 flex items-end justify-between">
            <h2 id="pop-h" className="section-title">
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
    <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-accent/40 bg-accent-soft/40 p-4">
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

const greetingKey = () => {
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "numeric", hourCycle: "h23" }).format(new Date()));
  return h < 12 ? "home.morning" : h < 17 ? "home.afternoon" : "home.evening";
};

/** Brand moment + the one thing a guest came to do: start (or continue) their order. */
function Hero({ menu, eta }: { menu: ShopMenu; eta: ReturnType<typeof useEta> }) {
  const t = useT();
  const hydrated = useShopHydrated();
  const mode = useShop((s) => s.mode);
  const table = useShop((s) => s.table);
  const setMode = useShop((s) => s.setMode);
  const openContext = useContextSheet((s) => s.set);
  const router = useRouter();
  const name = useAccount((s) => s.data?.customer.name?.split(" ")[0]);
  const [greet, setGreet] = useState<"home.morning" | "home.afternoon" | "home.evening" | null>(null);
  useEffect(() => setGreet(greetingKey()), []);
  const open = menu.ordering.accepting_orders;
  const chosen = hydrated && ((mode === "dine_in" && table) || mode === "takeaway");

  return (
    <section aria-label={menu.business.name} className="-mx-4 md:mx-0">
      <div className="relative overflow-hidden md:rounded-3xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/neelaryan-sign-960.webp" srcSet="/brand/neelaryan-sign-960.webp 960w, /brand/neelaryan-sign.webp 1536w" sizes="(min-width: 1200px) 1136px, 100vw" alt={`${menu.business.name} — ${menu.business.tagline}`} className="aspect-[16/9] w-full object-cover object-[center_42%] md:aspect-[21/9]" fetchPriority="high" />
        <div className="absolute right-3 top-3 sm:hidden">
          <LanguageSwitch compact />
        </div>
      </div>
      <div className="relative mx-3 -mt-8 rounded-2xl border border-line bg-surface p-5 shadow-lift md:mx-10 md:-mt-12 md:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow">{greet ? t(greet) : "\u00a0"}{name ? `, ${name}` : ""}</p>
            <h1 className="mt-1 font-display text-[26px] font-semibold leading-tight md:text-[34px]">{t("home.welcome", { name: brandName(menu.business.name) })}</h1>
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px]">
              <span className={open ? "inline-flex items-center gap-1.5 font-semibold text-success" : "inline-flex items-center gap-1.5 font-semibold text-warning"}>
                <span className={open ? "h-2 w-2 rounded-full bg-success" : "h-2 w-2 rounded-full bg-warning"} aria-hidden />
                {open ? t("home.open") : t("menu.closed")}
              </span>
              {open && eta && (
                <span className="inline-flex items-center gap-1.5 text-muted">
                  <Clock size={14} aria-hidden /> {t(eta.busy ? "eta.busy" : "eta.quiet", { min: eta.minutes })}
                </span>
              )}
            </p>
          </div>
        </div>

        {chosen ? (
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link href="/menu" className="inline-flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-full bg-primary px-6 text-[16px] font-semibold text-primary-fg shadow-card hover:bg-primary-hover sm:flex-none">
              <UtensilsCrossed size={18} aria-hidden /> {t("home.continue")}
            </Link>
            <button type="button" onClick={() => openContext(true)} className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-4 text-[14px] font-semibold text-muted hover:text-fg">
              {mode === "takeaway" ? <ShoppingBag size={16} aria-hidden /> : <QrCode size={16} aria-hidden />}
              {mode === "takeaway" ? t("ctx.nowTakeaway") : t("ctx.nowTable", { table: table!.label })} · <span className="underline underline-offset-4">{t("home.chooseCtx")}</span>
            </button>
          </div>
        ) : (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => openContext(true)} className="group flex items-center gap-3 rounded-2xl border border-line bg-bg/60 p-4 text-left transition-colors hover:border-accent">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-primary-fg">
                <QrCode size={19} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{t("home.dineIn")}</span>
                <span className="block text-[13px] text-muted">{t("home.dineInHint")}</span>
              </span>
            </button>
            <button
              type="button"
              disabled={!menu.ordering.takeaway_enabled}
              onClick={() => {
                setMode("takeaway");
                router.push("/menu");
              }}
              className="group flex items-center gap-3 rounded-2xl border border-line bg-bg/60 p-4 text-left transition-colors hover:border-accent disabled:opacity-50"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-accent-fg">
                <ShoppingBag size={19} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{t("ctx.takeaway")}</span>
                <span className="block text-[13px] text-muted">{menu.ordering.takeaway_enabled ? t("home.takeawayHint") : t("ctx.takeawayOff")}</span>
              </span>
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
