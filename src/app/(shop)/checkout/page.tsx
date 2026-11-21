"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, Check, CreditCard, Landmark, Lock, Smartphone, Store, ShieldCheck } from "lucide-react";
import { useApp, cartTotals } from "@/store/app";
import { newOrderId, readOrders, useOrders } from "@/store/orders";
import type { Order, OrderMode, PaymentMethod } from "@/store/types";
import { GST_RATE, PREP_ESTIMATE, TABLES } from "@/data/config";
import { useAppHydrated } from "@/lib/hooks";
import { rupees } from "@/lib/format";
import { clsx } from "@/lib/clsx";
import { MODES } from "@/components/shell/ModePicker";
import { Amount } from "@/components/ui/bits";

const STEPS = ["Details", "Payment", "Confirm"];

const METHODS: { id: PaymentMethod; title: string; sub: string; icon: typeof CreditCard }[] = [
  { id: "upi", title: "UPI", sub: "GPay, PhonePe, Paytm", icon: Smartphone },
  { id: "card", title: "Credit / Debit card", sub: "Visa, Mastercard, RuPay", icon: CreditCard },
  { id: "netbanking", title: "Net banking", sub: "All major banks", icon: Landmark },
  { id: "counter", title: "Pay at counter", sub: "Cash or card when you collect", icon: Store },
];

const PHONE = /^[6-9]\d{9}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function CheckoutPage() {
  const router = useRouter();
  const reduced = useReducedMotion();
  const hydrated = useAppHydrated();
  const app = useApp();
  const totals = cartTotals(app.cart, app.couponCode);
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<OrderMode>("dine-in");
  const [table, setTable] = useState<string | null>(null);
  const [address, setAddress] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [dob, setDob] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("upi");
  const [touched, setTouched] = useState(false);
  const [paying, setPaying] = useState(false);
  const [failed, setFailed] = useState(false);

  // prefill from what we already know
  useEffect(() => {
    if (!hydrated) return;
    const s = useApp.getState();
    setMode(s.mode ?? "dine-in");
    setTable(s.table);
    setAddress(s.address);
    if (s.profile) {
      setName(s.profile.name);
      setPhone(s.profile.phone);
      setEmail(s.profile.email ?? "");
      setDob(s.profile.dob ?? "");
    }
  }, [hydrated]);

  useEffect(() => {
    if (mode === "delivery" && method === "counter") setMethod("upi");
  }, [mode, method]);

  if (!hydrated) return <div className="min-h-[60vh]" aria-busy="true" />;

  if (app.cart.length === 0 && !paying) {
    return (
      <div className="mx-auto max-w-md py-24 text-center">
        <p className="font-display text-[32px] font-semibold text-navy-900">Your cart is empty</p>
        <p className="mt-1 text-ink-soft">Add something delicious first.</p>
        <Link href="/menu" className="btn-primary mt-6">
          Browse the menu
        </Link>
      </div>
    );
  }

  const phoneDigits = phone.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
  const errors = {
    name: name.trim().length < 2 ? "Please enter your name" : null,
    phone: !PHONE.test(phoneDigits) ? "Enter a valid 10-digit mobile number" : null,
    email: email && !EMAIL.test(email.trim()) ? "That email doesn't look right" : null,
    table: mode === "dine-in" && !table ? "Choose your table" : null,
    address: mode === "delivery" && address.trim().length < 8 ? "Please add your full delivery address" : null,
  };
  const detailsValid = !Object.values(errors).some(Boolean);

  const next = () => {
    if (step === 0) {
      setTouched(true);
      if (!detailsValid) {
        document.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
        return;
      }
    }
    setStep((s) => Math.min(2, s + 1));
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  };

  const place = async () => {
    setPaying(true);
    setFailed(false);
    // Demo payment. In production: create a Razorpay order on the server,
    // open checkout, and verify the signature server-side before confirming.
    await new Promise((r) => setTimeout(r, reduced ? 300 : 1800));
    const s = useApp.getState();
    const t = cartTotals(s.cart, s.couponCode);
    const now = Date.now();
    const order: Order = {
      id: newOrderId(readOrders()),
      createdAt: now,
      mode,
      table: mode === "dine-in" ? table ?? undefined : undefined,
      address: mode === "delivery" ? address.trim() : undefined,
      customer: { name: name.trim(), phone: phoneDigits, email: email.trim() || undefined },
      lines: s.cart,
      subtotal: t.subtotal,
      discount: t.discount,
      tax: t.tax,
      total: t.total,
      coupon: t.discount > 0 ? s.couponCode ?? undefined : undefined,
      payment: { method, status: method === "counter" ? "PENDING" : "PAID" },
      status: "NEW",
      history: [{ status: "NEW", at: now }],
    };
    try {
      useOrders.getState().add(order);
    } catch {
      setPaying(false);
      setFailed(true);
      return;
    }
    s.saveProfile({ name: order.customer.name, phone: order.customer.phone, email: order.customer.email, dob: dob || s.profile?.dob });
    if (mode === "delivery") s.setAddress(address.trim());
    s.setMode(mode, mode === "dine-in" ? table : null);
    router.replace(`/orders/${order.id}?placed=1`);
    // clear after navigating so the empty-cart state never flashes
    setTimeout(() => s.clearCart(), 400);
  };

  const field = "h-12 w-full rounded-2xl border bg-white/85 px-4 text-[15.5px] outline-none transition-colors focus:border-gold-500";
  const err = (k: keyof typeof errors) => touched && errors[k];

  return (
    <div className="mx-auto max-w-[1100px] pb-28 md:pb-10">
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={() => (step === 0 ? router.back() : setStep(step - 1))}
          className="grid h-11 w-11 place-items-center rounded-full border border-sand-400 bg-white/70 text-navy-800 hover:border-gold-500"
          aria-label="Back"
        >
          <ArrowLeft size={19} />
        </button>
        <h1 className="font-display text-[34px] font-semibold text-navy-900 md:text-[42px]">Checkout</h1>
      </div>

      <ol className="mb-6 flex items-center gap-2" aria-label="Checkout progress">
        {STEPS.map((s, i) => (
          <li key={s} className="flex flex-1 items-center gap-2" aria-current={i === step ? "step" : undefined}>
            <span className={clsx("grid h-8 w-8 shrink-0 place-items-center rounded-full text-[13px] font-bold transition-colors", i < step ? "bg-gold-500 text-navy-900" : i === step ? "bg-navy-800 text-ivory" : "bg-sand-400/60 text-ink-soft")}>
              {i < step ? <Check size={15} /> : i + 1}
            </span>
            <span className={clsx("text-[14px] font-semibold", i === step ? "text-navy-900" : "text-ink-muted")}>{s}</span>
            {i < STEPS.length - 1 && <span className="h-px flex-1 bg-sand-400/80" />}
          </li>
        ))}
      </ol>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            className="min-w-0"
            initial={reduced ? { opacity: 0 } : { opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, x: -30 }}
            transition={{ duration: 0.25 }}
          >
            {step === 0 && (
              <div className="space-y-6">
                <section aria-labelledby="ot">
                  <h2 id="ot" className="mb-2.5 text-[15px] font-bold text-navy-900">
                    Order type
                  </h2>
                  <div className="grid grid-cols-3 gap-2.5" role="radiogroup" aria-labelledby="ot">
                    {MODES.map((m) => {
                      const on = mode === m.id;
                      return (
                        <button key={m.id} role="radio" aria-checked={on} onClick={() => setMode(m.id)} className={clsx("flex min-h-[84px] flex-col items-center justify-center gap-1 rounded-2xl border text-[14px] font-bold transition-colors", on ? "border-navy-800 bg-navy-800 text-ivory shadow-lift" : "border-sand-400 bg-white/70 text-navy-800 hover:border-gold-500")}>
                          <m.icon size={20} />
                          {m.title}
                        </button>
                      );
                    })}
                  </div>
                </section>

                {mode === "dine-in" && (
                  <section aria-labelledby="tb">
                    <h2 id="tb" className="mb-2.5 text-[15px] font-bold text-navy-900">
                      Your table
                    </h2>
                    <div className="grid grid-cols-8 gap-1.5" role="radiogroup" aria-labelledby="tb" aria-invalid={!!err("table")}>
                      {TABLES.map((n) => (
                        <button key={n} role="radio" aria-checked={table === n} onClick={() => setTable(n)} className={clsx("h-11 rounded-xl border text-[14px] font-bold tabular-nums", table === n ? "border-gold-500 bg-gold-200 text-navy-900" : "border-sand-400 bg-white/70 text-navy-800 hover:border-gold-500")}>
                          {n}
                        </button>
                      ))}
                    </div>
                    {err("table") && <p className="mt-1.5 text-[13px] font-medium text-nonveg">{errors.table}</p>}
                  </section>
                )}

                {mode === "delivery" && (
                  <section>
                    <label htmlFor="addr" className="mb-2 block text-[15px] font-bold text-navy-900">
                      Delivery address
                    </label>
                    <textarea id="addr" rows={3} value={address} onChange={(e) => setAddress(e.target.value)} autoComplete="street-address" aria-invalid={!!err("address")} aria-describedby="addr-e" className={clsx(field, "h-auto resize-none py-3", err("address") ? "border-nonveg" : "border-sand-400")} placeholder="House / flat, street, landmark, area" />
                    {err("address") && <p id="addr-e" className="mt-1.5 text-[13px] font-medium text-nonveg">{errors.address}</p>}
                  </section>
                )}

                <section aria-labelledby="yd" className="space-y-3">
                  <h2 id="yd" className="text-[15px] font-bold text-navy-900">
                    Your details
                  </h2>
                  <div>
                    <label htmlFor="nm" className="mb-1 block text-[13.5px] font-semibold text-ink-soft">
                      Name
                    </label>
                    <input id="nm" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" aria-invalid={!!err("name")} aria-describedby="nm-e" className={clsx(field, err("name") ? "border-nonveg" : "border-sand-400")} />
                    {err("name") && <p id="nm-e" className="mt-1 text-[13px] font-medium text-nonveg">{errors.name}</p>}
                  </div>
                  <div>
                    <label htmlFor="ph" className="mb-1 block text-[13.5px] font-semibold text-ink-soft">
                      Mobile number
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[15.5px] font-semibold text-ink-muted">+91</span>
                      <input id="ph" type="tel" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d\s+]/g, "").slice(0, 14))} autoComplete="tel-national" aria-invalid={!!err("phone")} aria-describedby="ph-e" className={clsx(field, "pl-14", err("phone") ? "border-nonveg" : "border-sand-400")} placeholder="98765 43210" />
                    </div>
                    {err("phone") ? <p id="ph-e" className="mt-1 text-[13px] font-medium text-nonveg">{errors.phone}</p> : <p id="ph-e" className="mt-1 text-[12.5px] text-ink-muted">For order updates and your rewards.</p>}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label htmlFor="em" className="mb-1 block text-[13.5px] font-semibold text-ink-soft">
                        Email <span className="font-normal text-ink-muted">(optional)</span>
                      </label>
                      <input id="em" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" aria-invalid={!!err("email")} className={clsx(field, err("email") ? "border-nonveg" : "border-sand-400")} />
                      {err("email") && <p className="mt-1 text-[13px] font-medium text-nonveg">{errors.email}</p>}
                    </div>
                    <div>
                      <label htmlFor="dob" className="mb-1 block text-[13.5px] font-semibold text-ink-soft">
                        Birthday <span className="font-normal text-ink-muted">(optional, for a treat)</span>
                      </label>
                      <input id="dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} className={clsx(field, "border-sand-400")} max={new Date().toISOString().slice(0, 10)} />
                    </div>
                  </div>
                </section>
              </div>
            )}

            {step === 1 && (
              <section aria-labelledby="pm">
                <h2 id="pm" className="mb-3 text-[15px] font-bold text-navy-900">
                  Payment method
                </h2>
                <div className="space-y-2.5" role="radiogroup" aria-labelledby="pm">
                  {METHODS.filter((m) => !(m.id === "counter" && mode === "delivery")).map((m) => {
                    const on = method === m.id;
                    return (
                      <button key={m.id} role="radio" aria-checked={on} onClick={() => setMethod(m.id)} className={clsx("flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-colors", on ? "border-gold-500 bg-gold-200/40 shadow-gold" : "border-sand-400 bg-white/75 hover:border-gold-500")}>
                        <span className={clsx("grid h-5 w-5 shrink-0 place-items-center rounded-full border-2", on ? "border-navy-800" : "border-sand-600")}>{on && <span className="h-2.5 w-2.5 rounded-full bg-navy-800" />}</span>
                        <m.icon size={22} className="text-gold-700" />
                        <span>
                          <span className="block font-semibold text-navy-900">{m.title}</span>
                          <span className="block text-[13px] text-ink-muted">{m.sub}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-4 flex items-start gap-2 rounded-2xl bg-cream px-4 py-3 text-[13px] text-ink-soft">
                  <ShieldCheck size={17} className="mt-0.5 shrink-0 text-veg" />
                  Payments are processed securely by Razorpay. If a payment fails, your cart is kept so you can retry.
                </p>
              </section>
            )}

            {step === 2 && (
              <section aria-labelledby="rv" className="space-y-4">
                <h2 id="rv" className="text-[15px] font-bold text-navy-900">
                  Review your order
                </h2>
                <dl className="divide-y divide-sand-400/50 rounded-2xl border border-sand-400/60 bg-white/75 text-[14.5px]">
                  <Info label="Order type" value={MODES.find((m) => m.id === mode)!.title + (mode === "dine-in" && table ? ` · Table ${table}` : "")} onEdit={() => setStep(0)} />
                  {mode === "delivery" && <Info label="Deliver to" value={address} onEdit={() => setStep(0)} />}
                  <Info label="Name" value={`${name} · +91 ${phoneDigits}`} onEdit={() => setStep(0)} />
                  <Info label="Payment" value={METHODS.find((m) => m.id === method)!.title} onEdit={() => setStep(1)} />
                  <Info label="Ready in" value={PREP_ESTIMATE} />
                </dl>
                {failed && <p className="rounded-2xl bg-nonveg/10 px-4 py-3 text-[14px] font-medium text-nonveg">Payment didn&apos;t go through. Your cart is safe — please try again.</p>}
              </section>
            )}
          </motion.div>
        </AnimatePresence>

        <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start" aria-label="Order summary">
          <div className="rounded-3xl border border-sand-400/60 bg-white/75 p-5">
            <h2 className="font-display text-[24px] font-semibold text-navy-900">Order summary</h2>
            <ul className="mt-3 space-y-2 text-[14.5px]">
              {app.cart.map((l) => (
                <li key={l.key} className="flex justify-between gap-3">
                  <span className="min-w-0 text-navy-900">
                    <b className="tabular-nums">{l.qty}×</b> {l.name}
                    {l.details.length > 0 && <span className="block truncate text-[12.5px] text-ink-muted">{l.details.map((d) => d.value).join(", ")}</span>}
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">{rupees(l.unitPrice * l.qty)}</span>
                </li>
              ))}
            </ul>
            <div className="my-3 h-px bg-sand-400/70" />
            <dl className="space-y-1 text-[14px]">
              <div className="flex justify-between"><dt className="text-ink-soft">Subtotal</dt><dd className="tabular-nums">{rupees(totals.subtotal)}</dd></div>
              {totals.discount > 0 && <div className="flex justify-between text-veg"><dt>Discount</dt><dd className="tabular-nums">− {rupees(totals.discount)}</dd></div>}
              <div className="flex justify-between"><dt className="text-ink-soft">Taxes ({Math.round(GST_RATE * 100)}% GST)</dt><dd className="tabular-nums">{rupees(totals.tax)}</dd></div>
              <div className="flex justify-between pt-2 font-display text-[24px] font-semibold text-navy-900"><dt>Total</dt><dd><Amount value={totals.total} /></dd></div>
            </dl>
          </div>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-sand-400/60 bg-ivory/95 px-4 pb-[calc(env(safe-area-inset-bottom)+10px)] pt-3 backdrop-blur-md md:static md:mt-6 md:border-0 md:bg-transparent md:p-0">
        <div className="mx-auto max-w-[1100px] lg:grid lg:grid-cols-[1.4fr_1fr] lg:gap-6">
          {step < 2 ? (
            <button onClick={next} className="btn-primary h-14 w-full text-[16px]">
              Continue to {STEPS[step + 1].toLowerCase()}
            </button>
          ) : (
            <button onClick={place} disabled={paying} className="btn-gold h-14 w-full text-[16px]">
              <Lock size={17} /> {method === "counter" ? `Place order · ${rupees(totals.total)}` : `Pay ${rupees(totals.total)}`}
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>{paying && <PaymentOverlay counter={method === "counter"} />}</AnimatePresence>
    </div>
  );
}

function Info({ label, value, onEdit }: { label: string; value: string; onEdit?: () => void }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3">
      <dt className="shrink-0 text-ink-muted">{label}</dt>
      <dd className="flex min-w-0 items-start gap-3 text-right font-semibold text-navy-900">
        <span className="break-words">{value}</span>
        {onEdit && (
          <button onClick={onEdit} className="shrink-0 text-[13px] font-semibold text-gold-700 hover:underline">
            Edit
          </button>
        )}
      </dd>
    </div>
  );
}

/** A gold coin spinning in 3D while the payment is processed. */
function PaymentOverlay({ counter }: { counter: boolean }) {
  return (
    <motion.div className="fixed inset-0 z-[90] grid place-items-center bg-navy-950/60 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="alertdialog" aria-live="assertive" aria-label="Processing payment">
      <div className="flex flex-col items-center rounded-[28px] bg-ivory px-10 py-9 text-center shadow-lift">
        <div className="[perspective:600px]">
          <motion.div className="relative h-20 w-20 [transform-style:preserve-3d]" animate={{ rotateY: 360 }} transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}>
            <span className="absolute inset-0 grid place-items-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#fbe9b6,#d9b86a_45%,#a8812f)] font-display text-[34px] font-semibold italic text-navy-900 [backface-visibility:hidden]">N</span>
            <span className="absolute inset-0 grid place-items-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#fbe9b6,#d9b86a_45%,#a8812f)] font-display text-[30px] font-semibold text-navy-900 [backface-visibility:hidden] [transform:rotateY(180deg)]">₹</span>
          </motion.div>
        </div>
        <p className="mt-5 font-display text-[24px] font-semibold text-navy-900">{counter ? "Placing your order…" : "Processing payment…"}</p>
        <p className="mt-1 text-[14px] text-ink-muted">Please don&apos;t close this page.</p>
      </div>
    </motion.div>
  );
}
