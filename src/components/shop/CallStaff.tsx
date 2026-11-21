"use client";

import { useCallback, useEffect, useState } from "react";
import { BellRing, Check, Droplets, HandHelping, Receipt, Sparkles, Utensils } from "lucide-react";
import { useShop } from "@/lib/shop/store";
import { useMenu } from "@/lib/shop/menu";
import { useI18n, type MessageKey } from "@/lib/shop/i18n";
import { Sheet, Spinner, toast } from "./ui";
import { clsx } from "@/lib/clsx";

type Kind = "water" | "cutlery" | "clean" | "bill" | "help";
const KINDS: { kind: Kind; key: MessageKey; icon: typeof Droplets }[] = [
  { kind: "water", key: "help.water", icon: Droplets },
  { kind: "cutlery", key: "help.cutlery", icon: Utensils },
  { kind: "clean", key: "help.clean", icon: Sparkles },
  { kind: "bill", key: "help.bill", icon: Receipt },
  { kind: "help", key: "help.help", icon: HandHelping },
];
const STORE = "nr-requests";

interface Req {
  id: string;
  kind: Kind;
  created_at: string;
  resolved_at: string | null;
}

/** "Call staff" for guests at a table: water, cutlery, cleaning, the bill, or help. */
export function CallStaff() {
  const { t } = useI18n();
  const mode = useShop((s) => s.mode);
  const table = useShop((s) => s.table);
  const open = useMenu((s) => s.menu?.ordering.accepting_orders ?? true);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState<Kind | null>(null);
  const [reqs, setReqs] = useState<Req[]>([]);

  const refresh = useCallback(async () => {
    if (!table) return;
    let ids: string[] = [];
    try {
      ids = JSON.parse(sessionStorage.getItem(STORE) ?? "[]");
    } catch {
      /* ignore */
    }
    if (!ids.length) return setReqs([]);
    const r = await fetch(`/api/public/tables/${table.token}/requests?ids=${ids.join(",")}`, { cache: "no-store" }).catch(() => null);
    if (r?.ok) setReqs((await r.json()).requests);
  }, [table]);

  useEffect(() => {
    if (!show) return;
    refresh();
    const i = setInterval(refresh, 5000);
    return () => clearInterval(i);
  }, [show, refresh]);

  if (mode !== "dine_in" || !table || !open) return null;

  const send = async (kind: Kind) => {
    setBusy(kind);
    try {
      const r = await fetch(`/api/public/tables/${table.token}/requests`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind }) });
      const j = await r.json();
      if (!r.ok) return toast(j.error ?? "Couldn't send that. Please wave to our team.", "warn");
      try {
        const ids: string[] = JSON.parse(sessionStorage.getItem(STORE) ?? "[]");
        sessionStorage.setItem(STORE, JSON.stringify([j.id, ...ids.filter((x) => x !== j.id)].slice(0, 10)));
      } catch {
        /* ignore */
      }
      toast(t("help.sent"));
      refresh();
    } finally {
      setBusy(null);
    }
  };

  const recent = new Map<Kind, Req>();
  for (const r of reqs) if (Date.now() - new Date(r.created_at).getTime() < 30 * 60000 && !recent.has(r.kind)) recent.set(r.kind, r);

  return (
    <>
      <button
        type="button"
        onClick={() => setShow(true)}
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+5rem)] right-3 z-30 inline-flex h-12 items-center gap-2 rounded-full border border-line bg-surface px-4 text-[14px] font-semibold shadow-lift hover:border-line-strong md:bottom-6 md:right-6"
      >
        <BellRing size={18} aria-hidden /> {t("help.button")}
      </button>
      <Sheet open={show} onClose={() => setShow(false)} title={t("help.title")}>
        <div className="p-5">
          <p className="mb-4 text-[14px] text-muted">{t("help.sub", { table: table.label })}</p>
          <div className="grid grid-cols-2 gap-2.5">
            {KINDS.map(({ kind, key, icon: Icon }) => {
              const r = recent.get(kind);
              return (
                <button
                  key={kind}
                  type="button"
                  disabled={busy !== null}
                  onClick={() => send(kind)}
                  className={clsx("flex min-h-[72px] flex-col items-start justify-between rounded-xl border p-3 text-left", r && !r.resolved_at ? "border-primary bg-primary-soft" : "border-line hover:border-line-strong")}
                >
                  <span className="flex items-center gap-2 font-semibold">
                    {busy === kind ? <Spinner className="h-4 w-4" /> : <Icon size={18} aria-hidden />} {t(key)}
                  </span>
                  {r && (
                    <span className={clsx("mt-1 inline-flex items-center gap-1 text-[12.5px] font-semibold", r.resolved_at ? "text-success" : "text-primary")}>
                      {r.resolved_at ? (
                        <>
                          <Check size={13} aria-hidden /> {t("help.done")}
                        </>
                      ) : (
                        t("help.waiting")
                      )}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </Sheet>
    </>
  );
}
