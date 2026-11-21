"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Gift, QrCode, ShoppingBag, Ticket, X } from "lucide-react";
import { MenuGate } from "@/components/shop/ItemCard";
import { useContextSheet } from "@/components/shop/ContextSheet";
import { ShopButton, Spinner, rupee, toast } from "@/components/shop/ui";
import { priceCart, useShop, useShopHydrated } from "@/lib/shop/store";
import { useMenu, type ShopMenu } from "@/lib/shop/menu";
import { useAccount } from "@/lib/shop/account";
import { clsx } from "@/lib/clsx";

interface Quote {
  totals: { subtotal: number; discount: number; service_charge: number; tax: number; total: number };
  points_used: number;
  reward: { code: string; label: string; discount: number } | null;
  points: { balance: number; max: number; max_value: number; min: number; point_value: number; enabled: boolean } | null;
}

export default function CheckoutPage() {
  return <MenuGate>{(menu) => <Checkout menu={menu} />}</MenuGate>;
}

function Checkout({ menu }: { menu: ShopMenu }) {
  const router = useRouter();
  const hydrated = useShopHydrated();
  const { cart, mode, table, contact, setContact, addOrder, clear, newCheckoutKey, resetCheckoutKey } = useShop();
  const account = useAccount((s) => s.data);
  const reloadMenu = useMenu((s) => s.load);
  const openContext = useContextSheet((s) => s.set);
  const { lines, blocked, count } = priceCart(menu, cart);

  const [notes, setNotes] = useState("");
  const [usePoints, setUsePoints] = useState(false);
  const [rewardCode, setRewardCode] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteErr, setQuoteErr] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [err, setErr] = useState<{ text: string; field?: string } | null>(null);
  const [nonce, setNonce] = useState(0);

  // prefill from the account
  useEffect(() => {
    if (!account) return;
    if (!contact.name) setContact({ name: account.customer.name });
    if (!contact.phone && account.customer.phone) setContact({ phone: account.customer.phone });
  }, [account]); // eslint-disable-line react-hooks/exhaustive-deps

  const apiLines = useMemo(() => cart.map((l) => ({ item_id: l.item_id, variant_id: l.variant_id, modifier_ids: l.modifier_ids, qty: l.qty })), [cart]);
  const pointsWanted = usePoints && quote?.points ? quote.points.max : 0;

  // live server quote (authoritative totals, points and reward discount)
  useEffect(() => {
    if (!apiLines.length || blocked) return setQuote(null);
    const ctl = new AbortController();
    setQuoting(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch("/api/public/orders/quote", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lines: apiLines, use_points: pointsWanted, reward_code: rewardCode }), signal: ctl.signal });
        const j = await r.json();
        if (!r.ok) {
          setQuoteErr(j.error ?? "Couldn't price your order.");
          if (rewardCode && /reward|code/i.test(j.error ?? "")) setRewardCode(null);
          if (usePoints && /points/i.test(j.error ?? "")) setUsePoints(false);
        } else {
          setQuote(j);
          setQuoteErr(null);
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") setQuoteErr("You seem to be offline.");
      } finally {
        setQuoting(false);
      }
    }, 200);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [apiLines, pointsWanted, rewardCode, blocked, usePoints, account?.customer.id, nonce]);

  if (!hydrated) return null;
  if (!count)
    return (
      <div className="mx-auto max-w-md py-24 text-center">
        <ShoppingBag size={30} className="mx-auto text-muted" aria-hidden />
        <p className="mt-3 text-[20px] font-bold">Your order is empty</p>
        <Link href="/menu" className="mt-5 inline-flex min-h-[48px] items-center rounded-full bg-primary px-6 font-semibold text-primary-fg">
          Browse the menu
        </Link>
      </div>
    );

  const closed = !menu.ordering.accepting_orders;
  const needsContext = !mode || (mode === "dine_in" && !table);
  const phoneOk = /^[6-9]\d{9}$/.test(contact.phone);
  const nameOk = contact.name.trim().length >= 1;
  const openRewards = (account?.redemptions ?? []).filter((r) => r.status === "issued" && new Date(r.expires_at) > new Date());
  const canPlace = !closed && !needsContext && phoneOk && nameOk && !blocked && quote && !quoting && !placing && !(mode === "takeaway" && !menu.ordering.takeaway_enabled);

  const place = async () => {
    if (!quote) return;
    setPlacing(true);
    setErr(null);
    const { key, token } = newCheckoutKey();
    try {
      const r = await fetch("/api/public/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          idempotency_key: key,
          access_token: token,
          table_token: mode === "dine_in" ? table?.token : null,
          type: mode,
          customer_name: contact.name.trim(),
          customer_phone: contact.phone,
          notes,
          lines: cart.map((l) => ({ item_id: l.item_id, variant_id: l.variant_id, modifier_ids: l.modifier_ids, qty: l.qty, notes: l.notes })),
          expected_total: quote.totals.total,
          use_points: quote.points_used,
          reward_code: rewardCode,
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        if (j.code === "TOTAL_CHANGED") {
          await reloadMenu(true);
          resetCheckoutKey();
          setQuote(null);
          setNonce((n) => n + 1); // re-price with the new menu
        }
        if (j.fields?.table_token) useShop.getState().setTable(null);
        setErr({ text: j.error ?? "We couldn't place your order. Please try again.", field: Object.keys(j.fields ?? {})[0] });
        return;
      }
      addOrder({ id: j.id, number: j.number, token, placed_at: Date.now() });
      clear();
      toast(`Order #${j.number} placed`);
      router.replace(`/orders/${j.id}?placed=1`);
    } catch {
      setErr({ text: "Connection lost. Tap “Place order” again — you won't be charged or ordered twice." });
    } finally {
      setPlacing(false);
    }
  };

  const t = quote?.totals;
  return (
    <div className="mx-auto max-w-[1000px]">
      <Link href="/menu" className="inline-flex h-10 items-center gap-1.5 pr-3 text-[14px] font-semibold text-muted hover:text-fg">
        <ArrowLeft size={17} aria-hidden /> Keep browsing
      </Link>
      <h1 className="mt-1 font-display text-[34px] font-semibold">Checkout</h1>

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          {/* where */}
          <section className="rounded-3xl border border-line bg-surface p-5">
            <h2 className="text-[17px] font-bold">Where</h2>
            {needsContext ? (
              <div className="mt-2">
                <p className="text-[14.5px] text-muted">At a table? Scan the QR code on your table. Otherwise choose takeaway.</p>
                <ShopButton variant="secondary" className="mt-3" onClick={() => openContext(true)}>
                  Choose
                </ShopButton>
              </div>
            ) : (
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="flex items-center gap-2 text-[15px] font-semibold">
                  {mode === "dine_in" ? (
                    <>
                      <QrCode size={18} aria-hidden /> Table {table!.label} — we&apos;ll bring it to you
                    </>
                  ) : (
                    <>
                      <ShoppingBag size={18} aria-hidden /> Takeaway — collect at the counter
                    </>
                  )}
                </p>
                <button type="button" className="text-[14px] font-semibold text-primary hover:underline" onClick={() => openContext(true)}>
                  Change
                </button>
              </div>
            )}
          </section>

          {/* who */}
          <section className="rounded-3xl border border-line bg-surface p-5">
            <h2 className="text-[17px] font-bold">Your details</h2>
            <p className="mt-0.5 text-[13.5px] text-muted">So we can call your name and reach you about this order.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-[14px] font-semibold">Name</span>
                <input value={contact.name} onChange={(e) => setContact({ name: e.target.value })} maxLength={40} autoComplete="given-name" className="field-input h-12 w-full" aria-invalid={err?.field === "customer_name" || undefined} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[14px] font-semibold">Mobile</span>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">+91</span>
                  <input value={contact.phone} onChange={(e) => setContact({ phone: e.target.value.replace(/\D/g, "").slice(0, 10) })} inputMode="numeric" autoComplete="tel-national" className="field-input h-12 w-full pl-12" aria-invalid={(contact.phone.length === 10 && !phoneOk) || err?.field === "customer_phone" || undefined} />
                </div>
                {contact.phone.length === 10 && !phoneOk && <span className="mt-1 block text-[12.5px] text-danger">Enter a valid Indian mobile number</span>}
              </label>
            </div>
            <label className="mt-3 block">
              <span className="mb-1.5 block text-[14px] font-semibold">
                Note for the kitchen <span className="font-normal text-muted">(optional)</span>
              </span>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={200} rows={2} className="field-input w-full resize-none" placeholder="Allergies, when to serve…" />
            </label>
          </section>

          {/* rewards */}
          {menu.loyalty.enabled && (
            <section className="rounded-3xl border border-line bg-surface p-5">
              <h2 className="flex items-center gap-2 text-[17px] font-bold">
                <Gift size={18} aria-hidden /> Rewards
              </h2>
              {!account ? (
                <p className="mt-1 text-[14px] text-muted">
                  You&apos;ll earn points on this order — join after placing it, with just your mobile number.{" "}
                  <Link href="/account?next=/checkout" className="font-semibold text-primary hover:underline">
                    Already a member? Sign in
                  </Link>
                </p>
              ) : (
                <div className="mt-2 space-y-3">
                  {quote?.points && quote.points.balance > 0 && (
                    <label className={clsx("flex items-start gap-3 rounded-2xl border p-3", quote.points.max >= quote.points.min ? "border-line" : "border-line opacity-60")}>
                      <input type="checkbox" className="mt-0.5 h-5 w-5 accent-[rgb(var(--primary))]" checked={usePoints} disabled={quote.points.max < quote.points.min} onChange={(e) => setUsePoints(e.target.checked)} />
                      <span className="text-[14px]">
                        {quote.points.max >= quote.points.min ? (
                          <>
                            Use <b className="num">{quote.points.max}</b> points for <b className="num">{rupee(quote.points.max_value)}</b> off
                          </>
                        ) : (
                          <>You have {quote.points.balance} points — you can use them from {quote.points.min}.</>
                        )}
                        <span className="block text-[12.5px] text-muted">Balance: {quote.points.balance} points</span>
                      </span>
                    </label>
                  )}
                  {rewardCode ? (
                    <div className="flex items-center justify-between gap-2 rounded-2xl border border-primary bg-primary-soft px-3 py-2.5">
                      <span className="flex items-center gap-2 text-[14px] font-semibold">
                        <Ticket size={16} aria-hidden /> {quote?.reward?.label ?? rewardCode}
                        {quote?.reward && <span className="num font-normal text-muted">−{rupee(quote.reward.discount)}</span>}
                      </span>
                      <button type="button" onClick={() => setRewardCode(null)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-surface" aria-label="Remove reward">
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <>
                      {openRewards.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {openRewards.map((r) => (
                            <button key={r.id} type="button" onClick={() => setRewardCode(r.code)} className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[13.5px] font-semibold hover:border-primary">
                              <Ticket size={14} aria-hidden /> Use {r.name}
                            </button>
                          ))}
                        </div>
                      )}
                      <form
                        className="flex gap-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (codeInput.trim()) setRewardCode(codeInput.trim().toUpperCase());
                        }}
                      >
                        <input value={codeInput} onChange={(e) => setCodeInput(e.target.value)} placeholder="Reward code" aria-label="Reward code" className="field-input h-11 flex-1 uppercase" maxLength={20} />
                        <ShopButton type="submit" variant="secondary" className="min-h-[44px]" disabled={!codeInput.trim()}>
                          Apply
                        </ShopButton>
                      </form>
                    </>
                  )}
                </div>
              )}
            </section>
          )}
        </div>

        {/* summary */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <section className="rounded-3xl border border-line bg-surface">
            <h2 className="border-b border-line px-5 py-3.5 text-[17px] font-bold">
              Your order · {count} item{count === 1 ? "" : "s"}
            </h2>
            <ul className="max-h-[38vh] divide-y divide-line overflow-y-auto px-5">
              {lines.map((l) => (
                <li key={l.line.key} className="flex justify-between gap-3 py-2.5 text-[14px]">
                  <span className="min-w-0">
                    <span className="font-semibold">
                      {l.line.qty} × {l.name}
                    </span>
                    {l.detail && <span className="block text-[12.5px] text-muted">{l.detail}</span>}
                    {l.error && <span className="block text-[12.5px] font-semibold text-danger">{l.error}</span>}
                  </span>
                  <span className="num shrink-0">{rupee(l.total)}</span>
                </li>
              ))}
            </ul>
            <dl className="space-y-1 border-t border-line px-5 py-3 text-[14px]">
              {t ? (
                <>
                  <Row k="Items" v={rupee(t.subtotal)} />
                  {t.discount > 0 && <Row k="Discount" v={`−${rupee(t.discount)}`} accent />}
                  {t.service_charge > 0 && <Row k="Service charge" v={rupee(t.service_charge)} />}
                  <Row k={`GST (${menu.tax.gst_percent}%)`} v={rupee(t.tax)} />
                  <div className="flex justify-between pt-1 text-[18px] font-bold">
                    <dt>To pay</dt>
                    <dd className="num">{rupee(t.total)}</dd>
                  </div>
                </>
              ) : (
                <div className="flex justify-center py-2 text-muted">{quoting ? <Spinner /> : quoteErr}</div>
              )}
            </dl>
            <div className="border-t border-line p-5">
              {quoteErr && t && <p className="mb-3 rounded-xl bg-warning-soft px-3 py-2 text-[13.5px] text-warning">{quoteErr}</p>}
              {err && (
                <p className="mb-3 rounded-xl bg-danger-soft px-3 py-2 text-[13.5px] font-semibold text-danger" role="alert">
                  {err.text}
                </p>
              )}
              {closed && <p className="mb-3 rounded-xl bg-warning-soft px-3 py-2 text-[13.5px] text-warning">{menu.ordering.closed_message}</p>}
              <ShopButton className="w-full text-[16px]" loading={placing} disabled={!canPlace} onClick={place}>
                {needsContext ? "Choose dine-in or takeaway" : !nameOk || !phoneOk ? "Add your name and mobile" : `Place order${t ? ` · ${rupee(t.total)}` : ""}`}
              </ShopButton>
              <p className="mt-2 text-center text-[12.5px] text-muted">{mode === "dine_in" ? "Pay at your table or the counter when you're done." : "Pay at the counter when you collect."}</p>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Row({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted">{k}</dt>
      <dd className={clsx("num", accent && "font-semibold text-success")}>{v}</dd>
    </div>
  );
}
