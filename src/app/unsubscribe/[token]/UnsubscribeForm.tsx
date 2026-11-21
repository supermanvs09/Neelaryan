"use client";

import { useState } from "react";
import { apiFetch, type ClientApiError } from "@/lib/api-client";

export function UnsubscribeForm({ token, name, subscribed: initial }: { token: string; name: string; subscribed: boolean }) {
  const [subscribed, setSubscribed] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [changed, setChanged] = useState(false);
  const go = async (resubscribe: boolean) => {
    setBusy(true);
    setErr(null);
    try {
      await apiFetch("/api/public/unsubscribe", { body: { token, resubscribe } });
      setSubscribed(resubscribe);
      setChanged(true);
    } catch (e) {
      setErr((e as ClientApiError).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div aria-live="polite">
      <h1 className="mt-2 text-[22px] font-bold">{subscribed ? `Stop offers, ${name}?` : changed ? "You're unsubscribed" : `You're not receiving offers`}</h1>
      <p className="mt-2 text-muted">
        {subscribed
          ? "You'll stop getting offers and birthday messages from us. Your points and rewards stay exactly as they are."
          : "We won't send you offers or birthday messages. You can still collect and use points."}
      </p>
      {err && <p className="mt-3 text-[14px] font-semibold text-danger">{err}</p>}
      <div className="mt-5">
        {subscribed ? (
          <button type="button" onClick={() => go(false)} disabled={busy} className="btn btn-primary h-11 w-full">
            {busy ? "Saving…" : "Unsubscribe"}
          </button>
        ) : (
          <button type="button" onClick={() => go(true)} disabled={busy} className="btn btn-ghost h-11 w-full">
            {busy ? "Saving…" : "Changed your mind? Subscribe again"}
          </button>
        )}
      </div>
    </div>
  );
}
