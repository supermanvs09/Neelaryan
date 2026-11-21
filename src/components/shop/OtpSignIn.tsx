"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { useAccount } from "@/lib/shop/account";
import { ShopButton } from "./ui";
import { useT } from "@/lib/shop/i18n";

type Step = "phone" | "code" | "profile";

async function post<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error ?? "Something went wrong. Please try again."), { fields: j.fields as Record<string, string> | undefined });
  return j as T;
}

/**
 * Sign in or join with a one-time code sent to the mobile number. New customers then add
 * their name, birthday (optional) and choose whether to receive offers.
 * `claim` links the order they just placed to the account.
 */
export function OtpSignIn({ initialPhone = "", initialName = "", claim, onDone, compact }: { initialPhone?: string; initialName?: string; claim?: { order_id: string; access_token: string } | null; onDone?: (r: { claimed: { claimed: boolean; points: number } | null; isNew: boolean }) => void; compact?: boolean }) {
  const refresh = useAccount((s) => s.refresh);
  const t = useT();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState(initialPhone.replace(/\D/g, "").slice(-10));
  const [challenge, setChallenge] = useState<{ id: string; sent_to: string; dev_code?: string } | null>(null);
  const [code, setCode] = useState("");
  const [signupToken, setSignupToken] = useState("");
  const [name, setName] = useState(initialName);
  const [dob, setDob] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);
  useEffect(() => {
    if (step === "code") codeRef.current?.focus();
  }, [step]);

  const send = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await post<{ challenge_id: string; sent_to: string; dev_code?: string }>("/api/public/auth/otp", { channel: "sms", destination: phone });
      setChallenge({ id: r.challenge_id, sent_to: r.sent_to, dev_code: r.dev_code });
      setCode("");
      setStep("code");
      setCooldown(30);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const verify = async (c = code) => {
    if (!challenge || c.length !== 6) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await post<{ signed_in?: boolean; needs_profile?: boolean; signup_token?: string; claimed?: { claimed: boolean; points: number } | null }>("/api/public/auth/verify", { challenge_id: challenge.id, code: c, claim: claim ?? null });
      if (r.needs_profile) {
        setSignupToken(r.signup_token!);
        setStep("profile");
      } else {
        await refresh();
        onDone?.({ claimed: r.claimed ?? null, isNew: false });
      }
    } catch (e) {
      setErr((e as Error).message);
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  const register = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await post<{ claimed: { claimed: boolean; points: number } | null }>("/api/public/auth/register", { signup_token: signupToken, name, dob, email, marketing_consent: consent, claim: claim ?? null });
      await refresh();
      onDone?.({ claimed: r.claimed, isNew: true });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-3" aria-live="polite">
      {step === "phone" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (phone.length === 10) send();
          }}
        >
          <label htmlFor="otp-phone" className="mb-1.5 block text-[14px] font-semibold">
            {t("otp.mobile")}
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] text-muted">+91</span>
              <input id="otp-phone" inputMode="numeric" autoComplete="tel-national" maxLength={10} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} className="field-input h-12 w-full pl-12 text-[16px]" placeholder="98765 43210" />
            </div>
            <ShopButton type="submit" loading={busy} disabled={phone.length !== 10}>
              {t("otp.get")}
            </ShopButton>
          </div>
          {!compact && <p className="mt-2 text-[12.5px] text-muted">{t("otp.sms")}</p>}
        </form>
      )}

      {step === "code" && challenge && (
        <div>
          <label htmlFor="otp-code" className="mb-1.5 block text-[14px] font-semibold">
            {t("otp.enter", { to: challenge.sent_to })}
          </label>
          <input
            ref={codeRef}
            id="otp-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, 6);
              setCode(v);
              if (v.length === 6) verify(v);
            }}
            className="field-input num h-12 w-full text-center text-[22px] tracking-[0.5em]"
            placeholder="••••••"
          />
          {challenge.dev_code && (
            <p className="mt-2 rounded-lg bg-warning-soft px-3 py-2 text-[12.5px] text-warning">
              {t("otp.dev", { code: challenge.dev_code })}
            </p>
          )}
          <div className="mt-3 flex items-center justify-between text-[13.5px]">
            <button type="button" className="font-semibold text-primary hover:underline" onClick={() => setStep("phone")}>
              {t("otp.change")}
            </button>
            <button type="button" className="font-semibold text-primary hover:underline disabled:text-muted disabled:no-underline" disabled={cooldown > 0 || busy} onClick={send}>
              {cooldown > 0 ? t("otp.resendIn", { s: cooldown }) : t("otp.resend")}
            </button>
          </div>
          <ShopButton className="mt-3 w-full" loading={busy} disabled={code.length !== 6} onClick={() => verify()}>
            {t("otp.verify")}
          </ShopButton>
        </div>
      )}

      {step === "profile" && (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim().length >= 2) register();
          }}
        >
          <p className="flex items-center gap-1.5 text-[13.5px] font-semibold text-success">
            <ShieldCheck size={16} aria-hidden /> {t("otp.verified")}
          </p>
          <label className="block">
            <span className="mb-1.5 block text-[14px] font-semibold">{t("otp.name")}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoComplete="name" className="field-input h-12 w-full" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[14px] font-semibold">
              {t("otp.bday")}
            </span>
            <input type="date" value={dob} max={today} onChange={(e) => setDob(e.target.value)} className="field-input h-12 w-full" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[14px] font-semibold">
              {t("otp.email")}
            </span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className="field-input h-12 w-full" />
          </label>
          <label className="flex items-start gap-3 rounded-xl border border-line p-3">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-5 w-5 accent-[rgb(var(--primary))]" />
            <span className="text-[13.5px]">
              {t("otp.consent")}
            </span>
          </label>
          <ShopButton type="submit" className="w-full" loading={busy} disabled={name.trim().length < 2}>
            {t("otp.join")}
          </ShopButton>
          <p className="text-[12px] text-muted">
            <Link href="/legal/terms" className="underline">{t("otp.terms")}</Link>
          </p>
        </form>
      )}

      {err && (
        <p className="rounded-lg bg-danger-soft px-3 py-2 text-[13.5px] font-semibold text-danger" role="alert">
          {err}
        </p>
      )}
    </div>
  );
}
