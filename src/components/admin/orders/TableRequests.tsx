"use client";

import { useEffect, useRef, useState } from "react";
import { BellRing, Check } from "lucide-react";
import { Button, useToast } from "../ui";
import { useCan } from "../AdminShell";
import { apiFetch, useApi } from "@/lib/api-client";
import { minutesSince, chime } from "./shared";

interface Req {
  id: string;
  kind: "water" | "cutlery" | "clean" | "bill" | "help";
  created_at: string;
  resolved_at: string | null;
  table_label: string;
  resolved_by: string | null;
}
export const REQUEST_LABEL: Record<Req["kind"], string> = { water: "Water", cutlery: "Cutlery", clean: "Clean the table", bill: "Bring the bill", help: "Needs help" };

/** Open "call staff" requests from table QR pages. Hidden when there are none. */
export function TableRequests({ sound = false }: { sound?: boolean }) {
  const can = useCan();
  const toast = useToast();
  const { data, reload } = useApi<{ requests: Req[] }>("/api/admin/requests", { refreshMs: 5000 });
  const [busy, setBusy] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  const open = (data?.requests ?? []).filter((r) => !r.resolved_at);
  useEffect(() => {
    if (!data) return;
    const ids = new Set(open.map((r) => r.id));
    if (seen.current && sound && [...ids].some((id) => !seen.current!.has(id))) chime();
    seen.current = new Set([...(seen.current ?? []), ...ids]);
  }, [data, sound]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!open.length) return null;
  const canResolve = can(["orders.manage", "billing.manage", "kitchen.update"]);
  const done = async (id: string) => {
    setBusy(id);
    try {
      await apiFetch(`/api/admin/requests/${id}`, { method: "POST" });
      await reload();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  };
  return (
    <section aria-label="Table requests" className="mb-4 rounded-lg border border-warning/50 bg-warning-soft p-3">
      <h2 className="mb-2 flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide text-warning">
        <BellRing size={15} aria-hidden /> Table requests <span className="num rounded-md bg-surface px-1.5 text-fg">{open.length}</span>
      </h2>
      <ul className="flex flex-wrap gap-2">
        {open.map((r) => {
          const mins = minutesSince(r.created_at, now);
          return (
            <li key={r.id} className="flex items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2">
              <span>
                <span className="block text-[14px] font-bold">Table {r.table_label}</span>
                <span className="block text-[12.5px] text-muted">
                  {REQUEST_LABEL[r.kind]} · <span className={mins >= 5 ? "font-semibold text-danger" : ""}>{mins ? `${mins} min` : "now"}</span>
                </span>
              </span>
              {canResolve && (
                <Button size="sm" variant="secondary" icon={<Check size={14} />} loading={busy === r.id} onClick={() => done(r.id)}>
                  Done
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
