"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Trash2, TicketPercent, ShoppingBag, ArrowRight, Pencil, Check } from "lucide-react";
import { Sheet } from "../ui/Sheet";
import { Amount, QtyStepper } from "../ui/bits";
import { ItemVisual } from "../food/ItemVisual";
import { useApp, cartTotals, MAX_LINE_QTY } from "@/store/app";
import { useUI } from "@/store/ui";
import { MENU_BY_ID } from "@/data/menu";
import { COUPONS, GST_RATE } from "@/data/config";
import { rupees } from "@/lib/format";
import { useAppHydrated } from "@/lib/hooks";
import { clsx } from "@/lib/clsx";

export function CartPanel() {
  const open = useUI((s) => s.cartOpen);
  const close = useUI((s) => s.closeCart);
  const hydrated = useAppHydrated();
  const cart = useApp((s) => s.cart);
  const couponCode = useApp((s) => s.couponCode);
  const t = cartTotals(hydrated ? cart : [], couponCode);
  const router = useRouter();

  return (
    <Sheet
      open={open}
      onClose={close}
      variant="drawer"
      title={
        <span className="flex items-baseline gap-2">
          Your cart <span className="font-sans text-[14px] font-semibold text-ink-muted">({t.count} item{t.count === 1 ? "" : "s"})</span>
        </span>
      }
      footer={
        t.count > 0 ? (
          <button
            className="btn-primary h-14 w-full justify-between px-6 text-[16px]"
            onClick={() => {
              close();
              router.push("/checkout");
            }}
          >
            <span>Proceed to checkout</span>
            <span className="flex items-center gap-2">
              {rupees(t.total)} <ArrowRight size={18} />
            </span>
          </button>
        ) : undefined
      }
    >
      {t.count === 0 ? (
        <div className="flex flex-col items-center px-8 pb-12 pt-6 text-center">
          <div className="mb-5 grid h-24 w-24 place-items-center rounded-full bg-cream text-gold-600">
            <ShoppingBag size={38} />
          </div>
          <p className="font-display text-[26px] font-semibold text-navy-900">Your cart is empty</p>
          <p className="mt-1 max-w-xs text-[15px] text-ink-soft">Build a bowl, shake it up, or pick a favourite from the menu.</p>
          <Link href="/menu" onClick={close} className="btn-primary mt-6">
            Browse the menu
          </Link>
        </div>
      ) : (
        <div className="space-y-5 px-5 pb-6 md:px-7">
          <ul className="space-y-3">
            <AnimatePresence initial={false}>
              {cart.map((l) => {
                const item = MENU_BY_ID[l.itemId];
                return (
                  <motion.li
                    key={l.key}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -40, height: 0, marginTop: 0 }}
                    className="flex gap-3 rounded-2xl border border-sand-400/60 bg-white/75 p-3"
                  >
                    <div className="h-[76px] w-[76px] shrink-0 overflow-hidden rounded-xl bg-cream">
                      {item && <ItemVisual item={item} selection={l.builder?.selection} className="h-full w-full p-1" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold leading-snug text-navy-900">{l.name}</p>
                        <button
                          onClick={() => useApp.getState().removeLine(l.key)}
                          className="-mr-1 -mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-muted hover:bg-cream hover:text-nonveg"
                          aria-label={`Remove ${l.name}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      {(l.details.length > 0 || l.notes) && (
                        <p className="mt-0.5 line-clamp-3 text-[12.5px] leading-snug text-ink-muted">
                          {l.details.map((d) => `${d.label}: ${d.value}`).join(" · ")}
                          {l.notes ? ` · “${l.notes}”` : ""}
                        </p>
                      )}
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <QtyStepper size="sm" value={l.qty} min={1} max={MAX_LINE_QTY} onChange={(q) => useApp.getState().setQty(l.key, q)} label={l.name} />
                        <div className="flex items-center gap-2">
                          {l.builder && (
                            <Link href={`/build/${l.itemId}?edit=${encodeURIComponent(l.key)}`} onClick={close} className="grid h-9 w-9 place-items-center rounded-full text-ink-muted hover:bg-cream hover:text-navy-900" aria-label={`Edit ${l.name}`}>
                              <Pencil size={15} />
                            </Link>
                          )}
                          <span className="font-bold tabular-nums text-navy-900">{rupees(l.unitPrice * l.qty)}</span>
                        </div>
                      </div>
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>

          <CouponBox subtotal={t.subtotal} />

          <dl className="space-y-1.5 rounded-2xl bg-cream/80 p-4 text-[14.5px]">
            <Row label="Subtotal" value={rupees(t.subtotal)} />
            {t.discount > 0 && <Row label={`Discount (${couponCode})`} value={`− ${rupees(t.discount)}`} accent />}
            <Row label={`Taxes (${Math.round(GST_RATE * 100)}% GST)`} value={rupees(t.tax)} />
            <div className="my-2 h-px bg-sand-400/70" />
            <div className="flex items-center justify-between font-display text-[22px] font-semibold text-navy-900">
              <dt>Total</dt>
              <dd>
                <Amount value={t.total} />
              </dd>
            </div>
          </dl>
        </div>
      )}
    </Sheet>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-ink-soft">{label}</dt>
      <dd className={clsx("font-semibold tabular-nums", accent ? "text-veg" : "text-navy-900")}>{value}</dd>
    </div>
  );
}

function CouponBox({ subtotal }: { subtotal: number }) {
  const couponCode = useApp((s) => s.couponCode);
  const apply = useApp((s) => s.applyCoupon);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const tryApply = (raw: string) => {
    const c = COUPONS.find((x) => x.code === raw.trim().toUpperCase());
    if (!c) return setError("That code isn't valid.");
    if (subtotal < c.minOrder) return setError(`Add ${rupees(c.minOrder - subtotal)} more to use ${c.code}.`);
    setError(null);
    apply(c.code);
    setOpen(false);
    useUI.getState().showToast(`${c.code} applied`);
  };

  const applied = couponCode ? COUPONS.find((c) => c.code === couponCode) : null;
  const stillValid = applied ? subtotal >= applied.minOrder : true;

  return (
    <div className="rounded-2xl border border-dashed border-gold-500/70 bg-gold-200/30 p-3">
      {applied ? (
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-[14px]">
            <Check size={17} className={stillValid ? "text-veg" : "text-nonveg"} />
            <span>
              <b className="text-navy-900">{applied.code}</b> {stillValid ? "applied" : `needs ${rupees(applied.minOrder)}+`}
            </span>
          </p>
          <button className="text-[14px] font-semibold text-gold-700 underline-offset-2 hover:underline" onClick={() => apply(null)}>
            Remove
          </button>
        </div>
      ) : (
        <>
          <button className="flex w-full items-center justify-between text-left text-[15px] font-semibold text-navy-900" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            <span className="flex items-center gap-2">
              <TicketPercent size={18} className="text-gold-600" /> Apply coupon
            </span>
            <span className="text-[13px] text-gold-700">{open ? "Close" : "View offers"}</span>
          </button>
          {open && (
            <div className="mt-3 space-y-2">
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  tryApply(code);
                }}
              >
                <label className="sr-only" htmlFor="coupon">
                  Coupon code
                </label>
                <input
                  id="coupon"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Enter code"
                  autoCapitalize="characters"
                  className="h-11 min-w-0 flex-1 rounded-full border border-sand-400 bg-white px-4 text-[15px] uppercase outline-none focus:border-gold-500"
                />
                <button className="btn-primary h-11 min-h-0 px-5">Apply</button>
              </form>
              {error && <p className="text-[13px] font-medium text-nonveg">{error}</p>}
              {COUPONS.map((c) => (
                <button key={c.code} onClick={() => tryApply(c.code)} className="flex w-full items-center justify-between rounded-xl bg-white/80 px-3 py-2.5 text-left hover:bg-white">
                  <span>
                    <b className="text-[14px] tracking-wide text-navy-900">{c.code}</b>
                    <span className="block text-[12.5px] text-ink-muted">{c.title}</span>
                  </span>
                  <span className="text-[13px] font-semibold text-gold-700">Apply</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
