"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight, ReceiptText } from "lucide-react";
import { Spinner, rupee } from "@/components/shop/ui";
import { useShop, useShopHydrated } from "@/lib/shop/store";
import { useAccount } from "@/lib/shop/account";
import { clsx } from "@/lib/clsx";

interface Row {
  id: string;
  number: number;
  type: string;
  status: string;
  total: number;
  created_at: string;
  table_label: string | null;
  items: string;
}

const LABEL: Record<string, string> = { new: "Waiting to confirm", accepted: "Confirmed", preparing: "Being prepared", ready: "Ready", served: "Served", completed: "Completed", cancelled: "Cancelled", rejected: "Not accepted" };
const LIVE = new Set(["new", "accepted", "preparing", "ready", "served"]);

export default function OrdersPage() {
  const hydrated = useShopHydrated();
  const mine = useShop((s) => s.orders);
  const account = useAccount((s) => s.data);
  const signedIn = useAccount((s) => s.signedIn);
  const [device, setDevice] = useState<Row[] | null>(null);

  // orders placed on this phone (each fetched with its own device token)
  useEffect(() => {
    if (!hydrated) return;
    let cancel = false;
    Promise.all(
      mine.slice(0, 15).map(async (m) => {
        try {
          const r = await fetch(`/api/public/orders/${m.id}`, { headers: { "x-order-token": m.token }, cache: "no-store" });
          if (!r.ok) return null;
          const o = (await r.json()).order;
          return { id: o.id, number: o.number, type: o.type, status: o.status, total: Number(o.total), created_at: o.created_at, table_label: o.table_label, items: o.items.map((i: { qty: number; name: string }) => `${i.qty} × ${i.name}`).join(", ") } as Row;
        } catch {
          return null;
        }
      }),
    ).then((rows) => !cancel && setDevice(rows.filter(Boolean) as Row[]));
    return () => {
      cancel = true;
    };
  }, [hydrated, mine]);

  const merged = new Map<string, Row>();
  for (const o of device ?? []) merged.set(o.id, o);
  for (const o of account?.orders ?? []) if (!merged.has(o.id)) merged.set(o.id, { ...o, total: Number(o.total) });
  const rows = [...merged.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const loading = !hydrated || device === null || signedIn === null;

  return (
    <div className="mx-auto max-w-[720px]">
      <h1 className="text-[26px] font-bold">Your orders</h1>
      {loading ? (
        <div className="grid place-items-center py-20 text-muted">
          <Spinner />
        </div>
      ) : !rows.length ? (
        <div className="py-16 text-center">
          <ReceiptText size={28} className="mx-auto text-muted" aria-hidden />
          <p className="mt-3 text-[17px] font-semibold">No orders yet</p>
          <p className="mt-1 text-muted">{signedIn ? "Orders you place will show here." : "Orders placed on this phone show here. Sign in to see orders from other devices."}</p>
          <div className="mt-5 flex justify-center gap-3">
            <Link href="/menu" className="inline-flex min-h-[48px] items-center rounded-lg bg-primary px-6 font-semibold text-primary-fg">
              Browse the menu
            </Link>
            {!signedIn && (
              <Link href="/account?next=/orders" className="inline-flex min-h-[48px] items-center rounded-lg border border-line px-6 font-semibold">
                Sign in
              </Link>
            )}
          </div>
        </div>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {rows.map((o) => (
            <li key={o.id}>
              <Link href={`/orders/${o.id}`} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4 hover:border-line-strong">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="num font-bold">#{o.number}</span>
                    <span className={clsx("rounded-full px-2.5 py-0.5 text-[12px] font-semibold", LIVE.has(o.status) ? "bg-primary-soft text-fg" : o.status === "completed" ? "bg-success-soft text-success" : "bg-surface-2 text-muted")}>{LABEL[o.status] ?? o.status}</span>
                  </p>
                  <p className="mt-1 truncate text-[13.5px] text-muted">{o.items}</p>
                  <p className="mt-0.5 text-[12.5px] text-muted">
                    {new Date(o.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })} · {o.type === "dine_in" ? `Table ${o.table_label ?? ""}` : "Takeaway"}
                  </p>
                </div>
                <span className="num font-semibold">{rupee(o.total)}</span>
                <ChevronRight size={18} className="text-muted" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
