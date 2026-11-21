"use client";

import { useState } from "react";
import { BadgePercent, Plus } from "lucide-react";
import { Badge, Button, Card, Checkbox, DataTable, Dialog, Empty, ErrorBlock, Field, Input, LoadingBlock, Notice, PageHeader, Switch, useConfirm, useToast } from "./ui";
import { useCan } from "./AdminShell";
import { ClientApiError, apiFetch, useApi } from "@/lib/api-client";
import { rupees } from "@/lib/format";
import { cafeClock, daysLabel, isOfferLive, windowLabel, type Offer as LiveOffer } from "@/lib/offers";

interface Offer {
  id: string;
  title: string;
  percent_off: number;
  menu_item_ids: string[];
  days: number[];
  starts_at: string;
  ends_at: string;
  valid_from: string | null;
  valid_to: string | null;
  is_active: boolean;
  stats: { orders: number; units: number; discount: number };
}
interface MenuLite {
  categories: { id: string; name: string }[];
  items: { id: string; name: string; category_id: string; is_active?: boolean }[];
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function state(o: Offer): { label: string; tone: "success" | "neutral" | "warning" } {
  if (!o.is_active) return { label: "Paused", tone: "neutral" };
  const clock = cafeClock();
  if (o.valid_to && o.valid_to < clock.date) return { label: "Ended", tone: "neutral" };
  if (isOfferLive(o as unknown as LiveOffer, clock)) return { label: "Live now", tone: "success" };
  return { label: "Scheduled", tone: "warning" };
}

export function OffersPage() {
  const can = useCan();
  const { data, error, loading, reload } = useApi<{ offers: Offer[] }>("/api/admin/offers");
  const menu = useApi<MenuLite>(can("menu.view") ? "/api/admin/menu" : null);
  const [edit, setEdit] = useState<Offer | "new" | null>(null);
  const names = new Map((menu.data?.items ?? []).map((i) => [i.id, i.name]));
  const offers = data?.offers ?? [];
  const totals = offers.reduce((s, o) => ({ orders: s.orders + o.stats.orders, discount: s.discount + o.stats.discount }), { orders: 0, discount: 0 });

  return (
    <>
      <PageHeader
        title="Offers"
        description="Happy hours and percentage discounts. Customers see the offer price on the menu while it's live; the discount comes off the item price only, never add-ons."
        actions={
          can("menu.manage") && (
            <Button icon={<Plus size={16} />} onClick={() => setEdit("new")}>
              New offer
            </Button>
          )
        }
      />
      <ErrorBlock error={error} retry={reload} />
      {loading && !data ? (
        <LoadingBlock />
      ) : (
        <Card padded={false} title="All offers" description={offers.length ? `Last 30 days: ${totals.orders} orders used an offer, ${rupees(totals.discount)} given in discounts.` : undefined}>
          <DataTable
            rows={offers}
            rowKey={(o) => o.id}
            onRowClick={can("menu.manage") ? (o) => setEdit(o) : undefined}
            empty={<Empty icon={<BadgePercent size={22} />} title="No offers yet">Create a happy hour, e.g. 20% off cold coffee on weekdays 3–5 pm.</Empty>}
            columns={[
              { key: "title", header: "Offer", primary: true, cell: (o) => <span className="font-semibold">{o.title}</span> },
              { key: "pct", header: "Discount", cell: (o) => <span className="num">{o.percent_off}% off</span> },
              {
                key: "on",
                header: "Applies to",
                cell: (o) => (o.menu_item_ids.length ? <span title={o.menu_item_ids.map((id) => names.get(id) ?? "Removed item").join(", ")}>{o.menu_item_ids.length === 1 ? names.get(o.menu_item_ids[0]) ?? "1 item" : `${o.menu_item_ids.length} items`}</span> : "Whole menu"),
              },
              { key: "when", header: "When", cell: (o) => <span className="text-[13px]">{daysLabel(o.days)} · {windowLabel(o)}{o.valid_to ? ` · until ${o.valid_to}` : ""}</span> },
              { key: "state", header: "Status", cell: (o) => <Badge tone={state(o).tone}>{state(o).label}</Badge> },
              { key: "orders", header: "Orders (30d)", align: "right", cell: (o) => <span className="num">{o.stats.orders}</span> },
              { key: "disc", header: "Discount given", align: "right", cell: (o) => <span className="num">{rupees(o.stats.discount)}</span> },
            ]}
          />
        </Card>
      )}
      {edit && menu.data && <OfferEditor offer={edit === "new" ? null : edit} menu={menu.data} onClose={() => setEdit(null)} onSaved={() => (setEdit(null), reload())} />}
    </>
  );
}

function OfferEditor({ offer, menu, onClose, onSaved }: { offer: Offer | null; menu: MenuLite; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const { ask, node } = useConfirm();
  const [f, setF] = useState({
    title: offer?.title ?? "",
    percent_off: String(offer?.percent_off ?? 10),
    menu_item_ids: offer?.menu_item_ids ?? [],
    days: offer?.days ?? [],
    starts_at: offer?.starts_at ?? "00:00",
    ends_at: offer?.ends_at ?? "24:00",
    valid_from: offer?.valid_from ?? "",
    valid_to: offer?.valid_to ?? "",
    is_active: offer?.is_active ?? true,
  });
  const [scope, setScope] = useState<"all" | "some">(offer?.menu_item_ids.length ? "some" : "all");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<ClientApiError | null>(null);
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const allDay = f.starts_at === "00:00" && f.ends_at === "24:00";

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      const body = {
        title: f.title,
        percent_off: Number(f.percent_off),
        menu_item_ids: scope === "all" ? [] : f.menu_item_ids,
        days: f.days.length === 7 ? [] : [...f.days].sort(),
        starts_at: f.starts_at,
        ends_at: f.ends_at,
        valid_from: f.valid_from || null,
        valid_to: f.valid_to || null,
        is_active: f.is_active,
      };
      if (scope === "some" && !body.menu_item_ids.length) throw new ClientApiError(400, "Pick at least one item, or choose the whole menu.");
      if (offer) await apiFetch(`/api/admin/offers/${offer.id}`, { method: "PATCH", body });
      else await apiFetch("/api/admin/offers", { method: "POST", body });
      toast(offer ? "Offer saved" : "Offer created");
      onSaved();
    } catch (e) {
      setErr(e as ClientApiError);
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!offer) return;
    const r = await ask({ title: `Delete “${offer.title}”?`, body: "Past orders keep the discount they got. The offer stops applying straight away.", confirm: "Delete", danger: true });
    if (!r.ok) return;
    await apiFetch(`/api/admin/offers/${offer.id}`, { method: "DELETE" });
    toast("Offer deleted");
    onSaved();
  };

  return (
    <Dialog
      open
      side
      onClose={onClose}
      title={offer ? "Edit offer" : "New offer"}
      footer={
        <>
          {offer && (
            <Button variant="ghost" className="mr-auto text-danger" onClick={remove}>
              Delete
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={save}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {err && <Notice tone="danger">{err.message}</Notice>}
        <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
          <Field label="Name customers see" htmlFor="of-title" hint="e.g. Happy hour, Monsoon special">
            <Input id="of-title" value={f.title} maxLength={40} onChange={(e) => set({ title: e.target.value })} />
          </Field>
          <Field label="Discount" htmlFor="of-pct">
            <Input id="of-pct" type="number" min={1} max={90} inputMode="numeric" suffix="% off" value={f.percent_off} onChange={(e) => set({ percent_off: e.target.value })} />
          </Field>
        </div>

        <fieldset>
          <legend className="mb-1.5 text-[14px] font-semibold">Applies to</legend>
          <div className="flex gap-2">
            {(["all", "some"] as const).map((s) => (
              <Button key={s} size="sm" variant={scope === s ? "primary" : "secondary"} onClick={() => setScope(s)}>
                {s === "all" ? "Whole menu" : "Chosen items"}
              </Button>
            ))}
          </div>
          {scope === "some" && (
            <div className="mt-2 max-h-[260px] space-y-3 overflow-y-auto rounded-lg border border-line p-3">
              {menu.categories.map((c) => {
                const items = menu.items.filter((i) => i.category_id === c.id && i.is_active !== false);
                if (!items.length) return null;
                return (
                  <div key={c.id}>
                    <p className="mb-1 text-[12px] font-bold uppercase tracking-wide text-muted">{c.name}</p>
                    <div className="grid gap-1 sm:grid-cols-2">
                      {items.map((i) => (
                        <Checkbox key={i.id} label={i.name} checked={f.menu_item_ids.includes(i.id)} onChange={(v) => set({ menu_item_ids: v ? [...f.menu_item_ids, i.id] : f.menu_item_ids.filter((x) => x !== i.id) })} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </fieldset>

        <fieldset>
          <legend className="mb-1.5 text-[14px] font-semibold">Days</legend>
          <div className="flex flex-wrap gap-1.5">
            {DAYS.map((d, i) => {
              const n = i + 1;
              const on = f.days.length === 0 || f.days.includes(n);
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    const cur = f.days.length === 0 ? [1, 2, 3, 4, 5, 6, 7] : f.days;
                    const next = cur.includes(n) ? cur.filter((x) => x !== n) : [...cur, n];
                    set({ days: next.length === 7 || next.length === 0 ? [] : next });
                  }}
                  className={on ? "h-9 rounded-lg bg-primary px-3 text-[13px] font-semibold text-primary-fg" : "h-9 rounded-lg border border-line px-3 text-[13px] font-semibold text-muted"}
                >
                  {d}
                </button>
              );
            })}
          </div>
          <p className="mt-1 text-[12.5px] text-muted">{daysLabel(f.days)}</p>
        </fieldset>

        <div>
          <Checkbox label="All day" checked={allDay} onChange={(v) => set(v ? { starts_at: "00:00", ends_at: "24:00" } : { starts_at: "15:00", ends_at: "17:00" })} />
          {!allDay && (
            <div className="mt-2 grid grid-cols-2 gap-3">
              <Field label="From" htmlFor="of-s">
                <Input id="of-s" type="time" value={f.starts_at} onChange={(e) => set({ starts_at: e.target.value })} />
              </Field>
              <Field label="Until" htmlFor="of-e">
                <Input id="of-e" type="time" value={f.ends_at === "24:00" ? "23:59" : f.ends_at} onChange={(e) => set({ ends_at: e.target.value })} />
              </Field>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Starts on" optional htmlFor="of-vf">
            <Input id="of-vf" type="date" value={f.valid_from} onChange={(e) => set({ valid_from: e.target.value })} />
          </Field>
          <Field label="Ends on" optional htmlFor="of-vt">
            <Input id="of-vt" type="date" value={f.valid_to} min={f.valid_from || undefined} onChange={(e) => set({ valid_to: e.target.value })} />
          </Field>
        </div>
        <Switch label="Offer is on" checked={f.is_active} onChange={(v) => set({ is_active: v })} />
        <p className="text-[12.5px] text-muted">Times are café time (IST). If two offers cover the same item, the customer gets the bigger one. Loyalty points and reward codes still work on top.</p>
      </div>
      {node}
    </Dialog>
  );
}
