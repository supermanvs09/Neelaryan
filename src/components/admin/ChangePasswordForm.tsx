"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { Button, Field, Input, Notice } from "@/components/admin/ui";
import { apiFetch, ClientApiError } from "@/lib/api-client";
import { clsx } from "@/lib/clsx";

/** Password change: verifies the current one, enforces the policy, confirms the new one. */
export function ChangePasswordForm({ username, forced, onDone }: { username: string; forced: boolean; onDone?: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ClientApiError | null>(null);
  const [done, setDone] = useState(false);

  const rules = [
    { ok: next.length >= 10, text: "At least 10 characters" },
    { ok: /[a-zA-Z]/.test(next) && /[0-9]/.test(next), text: "Letters and a number" },
    { ok: next.length > 0 && !next.toLowerCase().includes(username.toLowerCase()), text: "Doesn't contain your username" },
    { ok: next.length > 0 && next === confirm, text: "Both new passwords match" },
  ];
  const valid = rules.every((r) => r.ok) && current.length > 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/auth/change-password", { body: { current, next, confirm } });
      if (forced) {
        window.location.assign("/admin");
        return;
      }
      setDone(true);
      setCurrent("");
      setNext("");
      setConfirm("");
      onDone?.();
    } catch (err) {
      setError(err as ClientApiError);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {done && <Notice tone="success">Password changed. Other devices have been signed out.</Notice>}
      {error && !error.fields && <Notice tone="danger">{error.message}</Notice>}
      <Field label="Current password" htmlFor="pw-current" error={error?.fields?.current}>
        <Input id="pw-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} invalid={!!error?.fields?.current} />
      </Field>
      <Field label="New password" htmlFor="pw-next" error={error?.fields?.next}>
        <Input id="pw-next" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} invalid={!!error?.fields?.next} />
      </Field>
      <Field label="Confirm new password" htmlFor="pw-confirm" error={error?.fields?.confirm}>
        <Input id="pw-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} invalid={!!error?.fields?.confirm} />
      </Field>
      <ul className="space-y-1 text-[13px]" aria-label="Password requirements">
        {rules.map((r) => (
          <li key={r.text} className={clsx("flex items-center gap-2", r.ok ? "text-success" : "text-muted")}>
            {r.ok ? <Check size={14} aria-hidden /> : <X size={14} aria-hidden />} {r.text}
          </li>
        ))}
      </ul>
      <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!valid}>
        {forced ? "Save and continue" : "Change password"}
      </Button>
      {forced && (
        <button
          type="button"
          className="w-full text-center text-[13px] text-muted hover:text-fg"
          onClick={async () => {
            await apiFetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
            window.location.assign("/login");
          }}
        >
          Sign out instead
        </button>
      )}
    </form>
  );
}
