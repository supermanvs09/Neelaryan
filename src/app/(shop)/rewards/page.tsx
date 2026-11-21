"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Copy, Gift, Ticket } from "lucide-react";
import { OtpSignIn } from "@/components/shop/OtpSignIn";
import { ShopButton, Spinner, rupee, toast } from "@/components/shop/ui";
import { useAccount, type Account } from "@/lib/shop/account";
import { useMenu } from "@/lib/shop/menu";
import { clsx } from "@/lib/clsx";
import { useT } from "@/lib/shop/i18n";
import { Logo } from "@/components/brand/Logo";

interface Catalogue {
  enabled: boolean;
  rewards: Account["rewards"];
  points_per_100?: number;
  min_order_amount?: number;
}

const KIND: Record<string, string> = { earn: "Earned", promo: "Bonus", adjust: "Adjusted", redeem: "Reward", expire: "Expired", reverse: "Refund", restore: "Returned" };
const date = (v: string) => new Date(v).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default function RewardsPage() {
  const t = useT();
  const signedIn = useAccount((s) => s.signedIn);
  const account = useAccount((s) => s.data);
  const refresh = useAccount((s) => s.refresh);
  const loyalty = useMenu((s) => s.menu?.loyalty);
  const [cat, setCat] = useState<Catalogue | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ code: string; reward: string; expires_at: string } | null>(null);

  useEffect(() => {
    fetch("/api/public/rewards", { cache: "no-store" })
      .then((r) => r.json())
      .then(setCat)
      .catch(() => setCat({ enabled: false, rewards: [] }));
  }, []);

  if (signedIn === null || !cat)
    return (
      <div className="grid place-items-center py-24 text-muted">
        <Spinner />
      </div>
    );
  if (!cat.enabled)
    return (
      <div className="mx-auto max-w-md py-24 text-center">
        <Gift size={28} className="mx-auto text-muted" aria-hidden />
        <p className="mt-3 text-[18px] font-semibold">{t("rw.paused")}</p>
      </div>
    );

  const redeem = async (id: string) => {
    setBusy(id);
    try {
      const r = await fetch(`/api/public/rewards/${id}/redeem`, { method: "POST" });
      const j = await r.json();
      if (!r.ok) return toast(j.error ?? "Couldn't redeem that reward.", "warn");
      setIssued(j);
      refresh();
    } finally {
      setBusy(null);
    }
  };

  const balance = account?.points.balance ?? 0;
  const open = (account?.redemptions ?? []).filter((r) => r.status === "issued" && new Date(r.expires_at) > new Date());

  return (
    <div className="mx-auto max-w-[860px] space-y-6">
      <h1 className="font-display text-[30px] font-semibold">{t("rw.title")}</h1>

      {account ? (
        <section className="on-navy relative grid gap-4 overflow-hidden rounded-3xl bg-brand-navy p-6 text-[#FAF6EC] shadow-lift md:grid-cols-[1fr_auto] md:items-center md:p-8">
          <span className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full border border-[#E2BF7A]/25" aria-hidden />
          <div className="relative">
            <Logo className="mb-4 w-[120px]" />
            <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[#E2BF7A]">{t("rw.points")}</p>
            <p className="num font-display text-[44px] font-semibold leading-none text-[#E2BF7A]">{balance.toLocaleString("en-IN")}</p>
            <p className="mt-2 text-[14px] text-[#FAF6EC]/80">
              {t("rw.worth", { value: rupee(account.points.value) })}
              {account.points.expiring && (
                <span className="text-[#E2BF7A]">
                  {" "}
                  · {t("rw.expire", { points: account.points.expiring.points, date: date(account.points.expiring.expires_at) })}
                </span>
              )}
            </p>
          </div>
          <p className="relative max-w-xs text-[13.5px] text-[#FAF6EC]/75">
            Earn {account.loyalty.points_per_100} points per ₹100 on completed orders{account.loyalty.min_order_amount > 0 ? ` over ${rupee(account.loyalty.min_order_amount)}` : ""}. Use them for rewards below, or at checkout from {account.loyalty.min_redeem_points} points.
          </p>
        </section>
      ) : (
        <section className="overflow-hidden rounded-3xl border border-line bg-surface shadow-lift">
          <div className="on-navy relative overflow-hidden bg-brand-navy px-6 py-7 text-[#FAF6EC] md:px-8">
            <span className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full border border-[#E2BF7A]/25" aria-hidden />
            <Logo className="relative mb-4 w-[120px]" />
            <h2 className="relative font-display text-[26px] font-semibold leading-tight">{t("rw.join")}</h2>
            <p className="relative mt-1.5 max-w-lg text-[14.5px] text-[#FAF6EC]/80">{t("rw.joinHint", { points: cat.points_per_100 ?? loyalty?.points_per_100 ?? 0 })}</p>
          </div>
          <div className="max-w-md px-6 py-6 md:px-8">
            <OtpSignIn onDone={({ isNew }) => toast(isNew ? "Welcome to rewards!" : "Signed in")} />
          </div>
        </section>
      )}

      {issued && (
        <section className="rounded-xl border-2 border-accent bg-accent-soft p-5 text-center" aria-live="polite">
          <p className="text-[14px] font-semibold text-accent-text">{t("rw.yours", { name: issued.reward })}</p>
          <p className="num my-2 text-[32px] font-bold tracking-widest">{issued.code}</p>
          <p className="text-[13.5px] text-muted">{t("rw.useIt", { date: date(issued.expires_at) })}</p>
          <ShopButton variant="secondary" className="mt-3" onClick={() => navigator.clipboard?.writeText(issued.code).then(() => toast("Code copied"), () => undefined)}>
            <Copy size={16} /> {t("rw.copy")}
          </ShopButton>
        </section>
      )}

      {open.length > 0 && (
        <section>
          <h2 className="section-title mb-3">{t("rw.ready")}</h2>
          <ul className="space-y-2">
            {open.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4">
                <span className="flex items-center gap-3">
                  <Ticket size={20} className="text-accent-text" aria-hidden />
                  <span>
                    <span className="block font-semibold">{r.name}</span>
                    <span className="block text-[12.5px] text-muted">{t("rw.validUntil", { date: date(r.expires_at) })}</span>
                  </span>
                </span>
                <span className="num rounded-lg bg-surface-2 px-2.5 py-1 font-bold tracking-wider">{r.code}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="section-title mb-3">{t("rw.catalogue")}</h2>
        {!cat.rewards.length ? (
          <p className="rounded-xl border border-line bg-surface p-5 text-muted">New rewards are on the way.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {cat.rewards.map((r) => {
              const short = Math.max(0, r.points_cost - balance);
              const out = r.left === 0;
              return (
                <li key={r.id} className="flex flex-col rounded-2xl border border-line bg-surface p-5 shadow-card">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-bold">{r.name}</p>
                    <span className="num shrink-0 rounded-full bg-accent-soft px-2.5 py-0.5 text-[13px] font-bold text-accent-text">{r.points_cost.toLocaleString("en-IN")} pts</span>
                  </div>
                  {r.description && <p className="mt-1 text-[13.5px] text-muted">{r.description}</p>}
                  <p className="mt-1 text-[12.5px] text-muted">
                    {r.min_order > 0 && `On bills over ${rupee(r.min_order)}. `}
                    {r.left !== null && r.left > 0 && `${r.left} left. `}
                    {r.valid_to && `Until ${date(r.valid_to)}.`}
                  </p>
                  {account && (
                    <div className="mt-auto pt-3">
                      {out ? (
                        <span className="text-[13.5px] font-semibold text-muted">{t("rw.gone")}</span>
                      ) : short > 0 ? (
                        <div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                            <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (balance / r.points_cost) * 100)}%` }} />
                          </div>
                          <p className="mt-1.5 text-[12.5px] text-muted">{t("rw.more", { n: short.toLocaleString("en-IN") })}</p>
                        </div>
                      ) : (
                        <ShopButton className="min-h-[42px] w-full" loading={busy === r.id} onClick={() => redeem(r.id)}>
                          {t("rw.redeem")}
                        </ShopButton>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {account && account.history.length > 0 && (
        <section>
          <h2 className="section-title mb-3">{t("rw.history")}</h2>
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
            {account.history.map((h, i) => (
              <li key={i} className="flex items-center justify-between gap-3 px-4 py-3 text-[14px]">
                <span>
                  <span className="font-semibold">{KIND[h.kind] ?? h.kind}</span>
                  <span className="text-muted"> · {h.note || date(h.created_at)}</span>
                </span>
                <span className={clsx("num font-semibold", h.points < 0 ? "text-danger" : "text-success")}>
                  {h.points > 0 && "+"}
                  {h.points}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {!account && (
        <p className="text-center text-[13.5px] text-muted">
          <Link href="/legal/terms" className="underline">
            How rewards work
          </Link>
        </p>
      )}
    </div>
  );
}
