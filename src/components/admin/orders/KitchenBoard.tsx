"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, BellOff, UtensilsCrossed, ShoppingBag } from "lucide-react";
import { Button, ErrorBlock, LoadingBlock, Segmented, useToast } from "../ui";
import { apiFetch, useApi, type ClientApiError } from "@/lib/api-client";
import { clsx } from "@/lib/clsx";
import { chime, minutesSince, modifierText, type OrderLine, type OrderStatus } from "./shared";

interface KOrder {
  id: string;
  number: number;
  type: "dine_in" | "takeaway";
  status: OrderStatus;
  notes: string;
  customer_name: string;
  created_at: string;
  accepted_at: string | null;
  ready_at: string | null;
  table_label: string | null;
  items: OrderLine[];
}

const NEXT: Partial<Record<OrderStatus, { to: OrderStatus; label: string }>> = {
  new: { to: "accepted", label: "Accept" },
  accepted: { to: "preparing", label: "Start preparing" },
  preparing: { to: "ready", label: "Mark ready" },
};

/** Kitchen workspace: big tickets, timers, one tap per step. No prices or phone numbers. */
export function KitchenBoard() {
  const { data, error, loading, reload } = useApi<{ orders: KOrder[] }>("/api/admin/kitchen", { refreshMs: 4000 });
  const toast = useToast();
  const [type, setType] = useState<"all" | "dine_in" | "takeaway">("all");
  const [sound, setSound] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [col, setCol] = useState<"new" | "prep" | "ready">("new");
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000);
    try {
      setSound(localStorage.getItem("nr-kitchen-sound") !== "0");
    } catch {
      /* ignore */
    }
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!data) return;
    const ids = new Set(data.orders.filter((o) => o.status === "new").map((o) => o.id));
    if (seen.current && sound && [...ids].some((id) => !seen.current!.has(id))) chime();
    seen.current = new Set([...(seen.current ?? []), ...ids]);
  }, [data, sound]);

  const orders = useMemo(() => (data?.orders ?? []).filter((o) => type === "all" || o.type === type), [data, type]);
  const cols = [
    { key: "new" as const, title: "New", list: orders.filter((o) => o.status === "new") },
    { key: "prep" as const, title: "Preparing", list: orders.filter((o) => o.status === "accepted" || o.status === "preparing") },
    { key: "ready" as const, title: "Ready", list: orders.filter((o) => o.status === "ready") },
  ];
  const done = orders.filter((o) => o.status === "served" || o.status === "completed");

  const advance = async (o: KOrder) => {
    const n = NEXT[o.status];
    if (!n) return;
    setBusy(o.id);
    try {
      await apiFetch(`/api/admin/orders/${o.id}/status`, { body: { to: n.to } });
      await reload();
    } catch (e) {
      toast((e as ClientApiError).message, "error");
      await reload();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="mr-2 text-[22px] font-bold">Kitchen</h1>
        <Segmented
          label="Order type"
          value={type}
          onChange={setType}
          items={[
            { value: "all", label: "All" },
            { value: "dine_in", label: "Dine-in" },
            { value: "takeaway", label: "Takeaway" },
          ]}
        />
        <Button
          variant="secondary"
          size="sm"
          className="ml-auto"
          icon={sound ? <Bell size={15} /> : <BellOff size={15} />}
          aria-pressed={sound}
          onClick={() => {
            const v = !sound;
            setSound(v);
            if (v) chime();
            try {
              localStorage.setItem("nr-kitchen-sound", v ? "1" : "0");
            } catch {
              /* ignore */
            }
          }}
        >
          Sound {sound ? "on" : "off"}
        </Button>
      </div>
      <ErrorBlock error={error} retry={reload} />

      {/* phones: one column at a time */}
      <div className="mb-3 grid grid-cols-3 gap-1 rounded-lg border border-line bg-surface p-1 md:hidden" role="tablist">
        {cols.map((c) => (
          <button key={c.key} role="tab" aria-selected={col === c.key} onClick={() => setCol(c.key)} className={clsx("h-10 rounded-md text-[14px] font-bold", col === c.key ? "bg-primary text-primary-fg" : "text-fg")}>
            {c.title} {c.list.length}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingBlock rows={6} />
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {cols.map((c) => (
            <section key={c.key} className={clsx("min-w-0", col !== c.key && "hidden md:block")} aria-label={c.title}>
              <h2 className="mb-2 hidden items-center gap-2 text-[14px] font-bold uppercase tracking-wide text-muted md:flex">
                {c.title} <span className="num rounded-md bg-surface-2 px-2 text-fg">{c.list.length}</span>
              </h2>
              <div className="space-y-3">
                {c.list.length === 0 && <p className="rounded-xl border border-dashed border-line py-10 text-center text-[14px] text-muted">Nothing here</p>}
                {c.list.map((o) => {
                  const since = o.status === "new" ? o.created_at : o.accepted_at ?? o.created_at;
                  const mins = minutesSince(o.status === "ready" ? o.ready_at ?? since : o.created_at, now);
                  const late = o.status !== "ready" && minutesSince(o.created_at, now) >= 15;
                  const n = NEXT[o.status];
                  return (
                    <article key={o.id} className={clsx("rounded-xl border-2 bg-surface p-4", o.status === "new" ? "border-accent" : late ? "border-danger" : "border-line")}>
                      <header className="flex items-start justify-between gap-2">
                        <div>
                          <p className="num text-[26px] font-bold leading-none">#{o.number}</p>
                          <p className="mt-1 flex items-center gap-1.5 text-[16px] font-bold text-accent-text">
                            {o.type === "dine_in" ? <UtensilsCrossed size={17} /> : <ShoppingBag size={17} />}
                            {o.type === "dine_in" ? `Table ${o.table_label ?? "—"}` : `Takeaway${o.customer_name ? ` · ${o.customer_name}` : ""}`}
                          </p>
                        </div>
                        <span className={clsx("num rounded-md px-2 py-1 text-[14px] font-bold", late ? "bg-danger-soft text-danger" : "bg-surface-2 text-fg")}>{mins} min</span>
                      </header>
                      <ul className="mt-3 space-y-2 border-t border-dashed border-line pt-3">
                        {o.items.map((i, k) => (
                          <li key={k} className="text-[17px] leading-snug">
                            <b className="num">{i.qty} ×</b> <span className="font-semibold">{i.name}</span>
                            {i.variant && <span className="text-muted"> ({i.variant})</span>}
                            {i.modifiers.length > 0 && <span className="block pl-7 text-[14px] text-muted">{modifierText(i.modifiers)}</span>}
                            {i.notes && <span className="block pl-7 text-[14px] font-bold text-danger">Note: {i.notes}</span>}
                          </li>
                        ))}
                      </ul>
                      {o.notes && <p className="mt-2 rounded-md bg-warning-soft px-2.5 py-1.5 text-[14px] font-semibold text-warning">Order note: {o.notes}</p>}
                      {n && (
                        <Button size="lg" className="mt-3 w-full text-[16px]" variant={o.status === "new" ? "accent" : "primary"} loading={busy === o.id} onClick={() => advance(o)}>
                          {n.label}
                        </Button>
                      )}
                      {o.status === "ready" && <p className="mt-3 text-center text-[13.5px] text-muted">{o.type === "dine_in" ? "Waiting to be served" : "Waiting for pickup"}</p>}
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {done.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-[13px] font-bold uppercase tracking-wide text-muted">Recently served</h2>
          <div className="flex flex-wrap gap-2">
            {done.map((o) => (
              <span key={o.id} className="num rounded-md border border-line bg-surface px-2.5 py-1 text-[13px] text-muted">
                #{o.number} {o.type === "dine_in" ? `· T${o.table_label}` : "· TA"}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
