"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { BadgeCheck, LogOut } from "lucide-react";
import { OtpSignIn } from "@/components/shop/OtpSignIn";
import { ShopButton, Spinner, toast } from "@/components/shop/ui";
import { ThemeSwitch } from "@/components/theme";
import { useAccount, type Account } from "@/lib/shop/account";
import { useT } from "@/lib/shop/i18n";
import { LanguageSwitch } from "@/components/shop/ShopShell";

export default function AccountPage() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const t = useT();
  const router = useRouter();
  const next = useSearchParams().get("next");
  const signedIn = useAccount((s) => s.signedIn);
  const data = useAccount((s) => s.data);
  if (signedIn === null)
    return (
      <div className="grid place-items-center py-24 text-muted">
        <Spinner />
      </div>
    );
  return (
    <div className="mx-auto max-w-[620px] space-y-6">
      <h1 className="text-[26px] font-bold">{t("acc.title")}</h1>
      {!data ? (
        <section className="rounded-xl border border-line bg-surface p-5 md:p-7">
          <h2 className="text-[18px] font-bold">{t("acc.signInTitle")}</h2>
          <p className="mt-1 text-[14.5px] text-muted">{t("acc.signInHint")}</p>
          <div className="mt-4">
            <OtpSignIn
              onDone={({ isNew }) => {
                toast(isNew ? "Welcome!" : "Signed in");
                if (next?.startsWith("/")) router.replace(next);
              }}
            />
          </div>
        </section>
      ) : (
        <Profile a={data} />
      )}
      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="text-[16px] font-bold">{t("acc.appearance")}</h2>
        <div className="mt-3">
          <ThemeSwitch />
        </div>
        <div className="mt-4 border-t border-line pt-4">
          <LanguageSwitch />
        </div>
      </section>
      <p className="text-center text-[13px] text-muted">
        <Link href="/legal/terms" className="underline">
          Terms & privacy
        </Link>
      </p>
    </div>
  );
}

function Profile({ a }: { a: Account }) {
  const t = useT();
  const set = useAccount((s) => s.set);
  const signOut = useAccount((s) => s.signOut);
  const c = a.customer;
  const [f, setF] = useState({ name: c.name, email: c.email ?? "", dob: c.dob ?? "", marketing_consent: c.marketing_consent });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => setF({ name: c.name, email: c.email ?? "", dob: c.dob ?? "", marketing_consent: c.marketing_consent }), [c.name, c.email, c.dob, c.marketing_consent]);
  const dirty = f.name !== c.name || f.email !== (c.email ?? "") || f.dob !== (c.dob ?? "") || f.marketing_consent !== c.marketing_consent;
  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/public/me", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(f) });
      const j = await r.json();
      if (!r.ok) return setErr(j.error ?? "Couldn't save.");
      set(j);
      toast(t("acc.saved"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="rounded-xl border border-line bg-surface p-5 md:p-7">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[20px] font-bold">{c.name}</p>
          <p className="flex items-center gap-1.5 text-[14px] text-muted">
            +91 {c.phone} <BadgeCheck size={15} className="text-success" aria-label="Verified" />
          </p>
          <p className="mt-1 text-[13px] text-muted">
            {c.visits} visit{c.visits === 1 ? "" : "s"} · {a.points.balance} points ·{" "}
            <Link href="/rewards" className="font-semibold text-primary hover:underline">
              Rewards
            </Link>
          </p>
        </div>
        <ShopButton
          variant="ghost"
          className="min-h-[40px] px-3 text-[14px]"
          onClick={async () => {
            await signOut();
            toast(t("acc.signOut"));
          }}
        >
          <LogOut size={16} /> {t("acc.signOut")}
        </ShopButton>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-[14px] font-semibold">{t("co.name")}</span>
          <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} maxLength={40} className="field-input h-12 w-full" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[14px] font-semibold">
            {t("acc.email")} <span className="font-normal text-muted">(optional)</span>
          </span>
          <input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className="field-input h-12 w-full" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[14px] font-semibold">{t("acc.birthday")}</span>
          <input type="date" value={f.dob} disabled={!!c.dob} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setF({ ...f, dob: e.target.value })} className="field-input h-12 w-full" />
          <span className="mt-1 block text-[12px] text-muted">{c.dob ? t("acc.birthdaySet") : t("acc.birthdayHint")}</span>
        </label>
      </div>
      <label className="mt-4 flex items-start gap-3 rounded-xl border border-line p-3">
        <input type="checkbox" className="mt-0.5 h-5 w-5 accent-[rgb(var(--primary))]" checked={f.marketing_consent} onChange={(e) => setF({ ...f, marketing_consent: e.target.checked })} />
        <span className="text-[14px]">
          {t("acc.offers")} <span className="block text-[12.5px] text-muted">{t("acc.offersHint")}</span>
        </span>
      </label>
      {err && <p className="mt-3 rounded-xl bg-danger-soft px-3 py-2 text-[13.5px] font-semibold text-danger">{err}</p>}
      <div className="mt-4 flex justify-end">
        <ShopButton onClick={save} loading={busy} disabled={!dirty || f.name.trim().length < 2}>
          {t("acc.save")}
        </ShopButton>
      </div>
    </section>
  );
}
