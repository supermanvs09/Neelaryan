"use client";

import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Gift, TicketPercent, Cake, Check } from "lucide-react";
import { StampCard } from "@/components/rewards/StampCard";
import { Sheet } from "@/components/ui/Sheet";
import { useOrders } from "@/store/orders";
import { useApp } from "@/store/app";
import { loyaltyFrom } from "@/lib/loyalty";
import { COUPONS, LOYALTY_REWARD, LOYALTY_TARGET } from "@/data/config";
import { dateOf, rupees } from "@/lib/format";
import { clsx } from "@/lib/clsx";

export default function RewardsPage() {
  const orders = useOrders((s) => s.orders);
  const hydrated = useOrders((s) => s.hydrated);
  const redeemed = useApp((s) => s.rewardsRedeemed);
  const redeem = useApp((s) => s.redeemReward);
  const [tab, setTab] = useState<"history" | "offers">("history");
  const [code, setCode] = useState<string | null>(null);
  const l = loyaltyFrom(orders, redeemed);

  return (
    <div className="mx-auto max-w-[900px] pb-10">
      <section className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-navy-700 to-navy-950 p-6 text-ivory shadow-lift md:p-9">
        <span aria-hidden className="absolute -right-20 -top-20 h-72 w-72 animate-sway rounded-full bg-[radial-gradient(circle,rgba(217,184,106,0.35),transparent_65%)]" />
        <p className="relative text-[11px] font-bold uppercase tracking-[0.22em] text-gold-300">NEELARYAN Rewards</p>
        <h1 className="relative mt-2 font-display text-[40px] font-semibold leading-none md:text-[52px]">Your journey</h1>
        <p className="relative mt-2 text-ivory/75">Good food brings brighter days.</p>
        <div className="relative mt-6 rounded-3xl bg-ivory/5 p-5 ring-1 ring-gold-400/30">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <p className="font-display text-[30px] font-semibold leading-none">
              {hydrated ? l.current : "–"} <span className="text-[18px] text-ivory/70">/ {LOYALTY_TARGET} stamps</span>
            </p>
            {l.available > 0 ? (
              <span className="rounded-full bg-gold-400 px-3 py-1 text-[12px] font-bold text-navy-900">Reward available</span>
            ) : (
              <span className="text-[13.5px] text-ivory/70">
                {l.toNext} more for {LOYALTY_REWARD}
              </span>
            )}
          </div>
          <StampCard current={hydrated ? l.current : 0} available={l.available} tone="dark" />
          <AnimatePresence>
            {l.available > 0 && (
              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                onClick={() => {
                  setCode(`NR-${Date.now().toString(36).slice(-5).toUpperCase()}`);
                  redeem();
                }}
                className="btn-gold mt-5 h-12 w-full"
              >
                <Gift size={17} /> Redeem {LOYALTY_REWARD}
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </section>

      <div className="mt-6 grid grid-cols-2 rounded-full border border-sand-400 bg-white/70 p-1" role="tablist" aria-label="Rewards">
        {(["history", "offers"] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={clsx("relative h-11 rounded-full text-[15px] font-semibold capitalize", tab === t ? "text-ivory" : "text-navy-800")}>
            {tab === t && <motion.span layoutId="rw-tab" className="absolute inset-0 rounded-full bg-navy-800" />}
            <span className="relative">{t}</span>
          </button>
        ))}
      </div>

      {tab === "history" ? (
        <section className="mt-4" role="tabpanel" aria-label="Stamp history">
          {l.stamped.length === 0 ? (
            <p className="rounded-3xl bg-cream px-5 py-6 text-center text-ink-soft">
              No stamps yet. Complete a paid order to earn your first one.{" "}
              <Link href="/menu" className="font-semibold text-navy-900 underline">
                Order now
              </Link>
            </p>
          ) : (
            <ul className="space-y-2.5">
              {l.stamped.map((o) => (
                <li key={o.id} className="card flex items-center justify-between gap-3 p-4">
                  <span>
                    <Link href={`/orders/${o.id}`} className="font-semibold text-navy-900 hover:underline">
                      Order #{o.id}
                    </Link>
                    <span className="block text-[13px] text-ink-muted">
                      {rupees(o.total)} · {dateOf(o.completedAt ?? o.createdAt)}
                    </span>
                  </span>
                  <span className="flex items-center gap-1 rounded-full bg-gold-200 px-3 py-1 text-[12.5px] font-bold text-gold-700">
                    <Check size={13} /> +1 stamp
                  </span>
                </li>
              ))}
            </ul>
          )}
          {redeemed > 0 && (
            <p className="mt-3 text-center text-[13px] text-ink-muted">
              {redeemed} reward{redeemed > 1 ? "s" : ""} redeemed so far.
            </p>
          )}
        </section>
      ) : (
        <section className="mt-4 space-y-2.5" role="tabpanel" aria-label="Offers">
          {COUPONS.map((c) => (
            <div key={c.code} className="card flex items-center gap-4 p-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gold-200 text-gold-700">
                <TicketPercent size={20} />
              </span>
              <span className="flex-1">
                <b className="tracking-wide text-navy-900">{c.code}</b>
                <span className="block text-[13.5px] text-ink-muted">{c.title}</span>
              </span>
              <span className="text-[12.5px] text-ink-muted">Apply in cart</span>
            </div>
          ))}
          <div className="card flex items-center gap-4 p-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gold-200 text-gold-700">
              <Cake size={20} />
            </span>
            <span className="flex-1 text-[14px] text-ink-soft">
              <b className="text-navy-900">Birthday treat</b>
              <span className="block">Add your birthday at checkout and we&apos;ll send you something special.</span>
            </span>
          </div>
        </section>
      )}

      <section className="mt-8 rounded-3xl border border-sand-400/60 bg-white/60 p-5 text-[14px] text-ink-soft">
        <h2 className="mb-2 font-display text-[22px] font-semibold text-navy-900">How stamps work</h2>
        <ul className="list-inside list-disc space-y-1">
          <li>One stamp for each completed, paid order — up to one per day.</li>
          <li>
            Collect {LOYALTY_TARGET} stamps for {LOYALTY_REWARD}.
          </li>
          <li>Failed payments or scanning a QR code alone don&apos;t earn stamps.</li>
          <li>Missed a stamp? Ask our team — we&apos;ll check your order and add it.</li>
        </ul>
      </section>

      <Sheet open={!!code} onClose={() => setCode(null)} title="Enjoy your treat!">
        <div className="px-5 pb-8 text-center md:px-7">
          <p className="text-ink-soft">Show this code to our team to claim {LOYALTY_REWARD}.</p>
          <p className="mx-auto mt-4 w-fit rounded-2xl border-2 border-dashed border-gold-500 bg-gold-200/40 px-6 py-3 font-display text-[34px] font-semibold tracking-[0.12em] text-navy-900">{code}</p>
        </div>
      </Sheet>
    </div>
  );
}
