"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Bell, ChevronRight, CreditCard, FileText, Gift, HelpCircle, Info, LogOut, MapPin, ReceiptText, Sparkles, ChefHat } from "lucide-react";
import { useApp } from "@/store/app";
import { useUI } from "@/store/ui";
import { useOrders } from "@/store/orders";
import { useAppHydrated } from "@/lib/hooks";
import { loyaltyFrom } from "@/lib/loyalty";
import { Sheet } from "@/components/ui/Sheet";
import { LOYALTY_TARGET } from "@/data/config";
import { clsx } from "@/lib/clsx";

function Row({ icon, label, href, onClick, right }: { icon: ReactNode; label: string; href?: string; onClick?: () => void; right?: ReactNode }) {
  const inner = (
    <>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cream text-gold-700">{icon}</span>
      <span className="min-w-0 flex-1 truncate font-semibold text-navy-900">{label}</span>
      {right ?? <ChevronRight size={18} className="shrink-0 text-ink-muted" />}
    </>
  );
  const cls = "flex min-h-[60px] w-full items-center gap-3 px-4 py-2 text-left hover:bg-cream/60";
  if (href)
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  if (onClick)
    return (
      <button onClick={onClick} className={cls}>
        {inner}
      </button>
    );
  return <div className={cls}>{inner}</div>;
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={clsx("relative h-7 w-12 shrink-0 rounded-full transition-colors", on ? "bg-navy-800" : "bg-sand-400")}>
      <span className={clsx("absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-[left]", on ? "left-6" : "left-1")} />
    </button>
  );
}

export default function ProfilePage() {
  const hydrated = useAppHydrated();
  const app = useApp();
  const orders = useOrders((s) => s.orders);
  const l = loyaltyFrom(orders, app.rewardsRedeemed);
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const p = app.profile;

  const openEdit = () => {
    setName(p?.name ?? "");
    setPhone(p?.phone ?? "");
    setAddress(app.address);
    setEdit(true);
  };

  if (!hydrated) return <div className="min-h-[60vh]" aria-busy="true" />;
  const initials = (p?.name ?? "Guest")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="mx-auto max-w-[720px] pb-10">
      <h1 className="font-display text-[44px] font-semibold leading-none text-navy-900">My profile</h1>
      <section className="card mt-5 flex items-center gap-4 p-5">
        <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-gradient-to-br from-navy-700 to-navy-900 font-display text-[24px] font-semibold text-gold-300">{initials}</span>
        <span className="min-w-0 flex-1">
          <b className="block truncate text-[18px] text-navy-900">{p?.name ?? "Guest"}</b>
          <span className="text-[14px] text-ink-muted">{p?.phone ? `+91 ${p.phone.replace(/(\d{5})(\d{5})/, "$1 $2")}` : "Ordering as a guest — no login needed"}</span>
        </span>
        <button onClick={openEdit} className="shrink-0 text-[14px] font-semibold text-gold-700 hover:underline">
          {p ? "Edit" : "Add details"}
        </button>
      </section>

      <section className="card mt-4 divide-y divide-sand-400/50 overflow-hidden">
        <Row icon={<ReceiptText size={19} />} label="My orders" href="/orders" right={<span className="text-[13px] text-ink-muted">{orders.length}</span>} />
        <Row
          icon={<Gift size={19} />}
          label="My rewards"
          href="/rewards"
          right={
            <span className="text-[13px] text-ink-muted">
              {l.current} / {LOYALTY_TARGET} stamps
            </span>
          }
        />
        <Row icon={<MapPin size={19} />} label={app.address ? `Saved address · ${app.address}` : "Add a delivery address"} onClick={openEdit} />
        <Row icon={<CreditCard size={19} />} label="Payment methods" right={<span className="shrink-0 text-[12.5px] text-ink-muted">Secured by Razorpay</span>} />
      </section>

      <section className="card mt-4 divide-y divide-sand-400/50 overflow-hidden">
        <Row icon={<Bell size={19} />} label="Order notifications" right={<Toggle on={app.notifications} onChange={(v) => app.setPref("notifications", v)} label="Order notifications" />} />
        <Row icon={<Sparkles size={19} />} label="Special offers" right={<Toggle on={app.offers} onChange={(v) => app.setPref("offers", v)} label="Special offers" />} />
      </section>

      <section id="visit" className="card mt-4 divide-y divide-sand-400/50 overflow-hidden">
        <Row icon={<HelpCircle size={19} />} label="Help & support" href="/legal/support" />
        <Row icon={<Info size={19} />} label="About NEELARYAN" href="/legal/about" />
        <Row icon={<FileText size={19} />} label="Terms, privacy & refunds" href="/legal/terms" />
        <Row icon={<ChefHat size={19} />} label="Staff / Kitchen" href="/staff" />
      </section>

      {p && (
        <button
          onClick={() => {
            app.saveProfile(null);
            useUI.getState().showToast("Your details were removed from this device");
          }}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border border-nonveg/30 bg-white/70 py-3.5 font-semibold text-nonveg hover:bg-nonveg/5"
        >
          <LogOut size={18} /> Sign out
        </button>
      )}

      <Sheet
        open={edit}
        onClose={() => setEdit(false)}
        title="Your details"
        footer={
          <button
            className="btn-primary w-full"
            disabled={name.trim().length < 2 || !/^[6-9]\d{9}$/.test(phone)}
            onClick={() => {
              app.saveProfile({ ...(p ?? {}), name: name.trim(), phone });
              app.setAddress(address.trim());
              setEdit(false);
              useUI.getState().showToast("Saved");
            }}
          >
            Save
          </button>
        }
      >
        <div className="space-y-3 px-5 pb-5 md:px-7">
          <label className="block">
            <span className="mb-1 block text-[13.5px] font-semibold text-ink-soft">Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className="h-12 w-full rounded-2xl border border-sand-400 bg-white px-4 outline-none focus:border-gold-500" />
          </label>
          <label className="block">
            <span className="mb-1 block text-[13.5px] font-semibold text-ink-soft">Mobile (10 digits)</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" autoComplete="tel-national" className="h-12 w-full rounded-2xl border border-sand-400 bg-white px-4 outline-none focus:border-gold-500" />
          </label>
          <label className="block">
            <span className="mb-1 block text-[13.5px] font-semibold text-ink-soft">Delivery address</span>
            <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={3} autoComplete="street-address" className="w-full resize-none rounded-2xl border border-sand-400 bg-white px-4 py-3 outline-none focus:border-gold-500" />
          </label>
        </div>
      </Sheet>
    </div>
  );
}
