"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Search } from "lucide-react";
import { Badge, Button, Card, Checkbox, DataTable, Dialog, Empty, ErrorBlock, Field, Input, LoadingBlock, Notice, PageHeader, Select, Stat, Switch, Tabs, Textarea, useConfirm, useToast } from "../ui";
import { useCan } from "../AdminShell";
import { apiFetch, qs, useApi, type ClientApiError } from "@/lib/api-client";
import { dateOf, dateTime, money } from "@/lib/format";

interface LoyaltySettings {
  enabled: boolean;
  points_per_100: number;
  min_order_amount: number;
  point_value: number;
  min_redeem_points: number;
  max_redeem_percent: number;
  expiry_months: number;
  welcome_bonus: number;
  promo_multiplier: number;
  promo_from: string | null;
  promo_to: string | null;
}

export function LoyaltyPage() {
  const [tab, setTab] = useState<"programme" | "rewards" | "redemptions">("programme");
  return (
    <>
      <PageHeader title="Loyalty & rewards" description="Customers earn points on completed, paid orders and spend them on rewards or off their bill." />
      <Tabs
        className="mb-4"
        value={tab}
        onChange={setTab}
        items={[
          { value: "programme", label: "Programme" },
          { value: "rewards", label: "Rewards" },
          { value: "redemptions", label: "Redemptions" },
        ]}
      />
      {tab === "programme" && <Programme />}
      {tab === "rewards" && <Rewards />}
      {tab === "redemptions" && <Redemptions />}
    </>
  );
}

/* ── Programme settings ─────────────────────────────────────────────────── */

function Programme() {
  const { data, error, loading, reload } = useApi<{ settings: LoyaltySettings; stats: { members: number; outstanding: number; earned_30d: number; redeemed_30d: number; open_rewards: number; liability: number } }>("/api/admin/loyalty");
  if (error) return <ErrorBlock error={error} retry={reload} />;
  if (loading || !data) return <LoadingBlock rows={6} />;
  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Points outstanding" value={data.stats.outstanding.toLocaleString("en-IN")} sub={`Worth ${money(data.stats.liability)} if all redeemed`} />
        <Stat label="Earned in 30 days" value={data.stats.earned_30d.toLocaleString("en-IN")} />
        <Stat label="Redeemed in 30 days" value={data.stats.redeemed_30d.toLocaleString("en-IN")} />
        <Stat label="Unused reward codes" value={data.stats.open_rewards} />
      </div>
      <SettingsForm initial={data.settings} onSaved={reload} />
    </>
  );
}

function SettingsForm({ initial, onSaved }: { initial: LoyaltySettings; onSaved: () => void }) {
  const can = useCan();
  const toast = useToast();
  const [s, setS] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<ClientApiError | null>(null);
  const set = (p: Partial<LoyaltySettings>) => setS((x) => ({ ...x, ...p }));
  const num = (k: keyof LoyaltySettings) => ({
    value: String(s[k] ?? ""),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => set({ [k]: e.target.value === "" ? 0 : Number(e.target.value.replace(/[^\d.]/g, "")) } as Partial<LoyaltySettings>),
    inputMode: "decimal" as const,
    disabled: !can("loyalty.manage"),
  });
  const dirty = JSON.stringify(s) !== JSON.stringify(initial);
  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      await apiFetch("/api/admin/loyalty", { method: "PUT", body: { ...s, promo_from: s.promo_from || null, promo_to: s.promo_to || null } });
      toast("Loyalty settings saved — they apply to new orders from now");
      onSaved();
    } catch (e) {
      setErr(e as ClientApiError);
    } finally {
      setBusy(false);
    }
  };
  const fe = err?.fields ?? {};
  const example = 500;
  const earn = example >= s.min_order_amount ? Math.floor((example / 100) * s.points_per_100) : 0;
  const ordersToRedeem = s.points_per_100 > 0 ? Math.ceil(s.min_redeem_points / ((example / 100) * s.points_per_100)) : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <Card
        title="How points work"
        actions={can("loyalty.manage") && <Switch label="Programme on" checked={s.enabled} onChange={(v) => set({ enabled: v })} />}
      >
        {err && !err.fields && <Notice tone="danger" className="mb-3">{err.message}</Notice>}
        {!s.enabled && <Notice tone="warning" className="mb-3">The programme is off: no points are earned or spent, and rewards are hidden from customers. Existing balances are kept.</Notice>}
        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="eyebrow mb-2">Earning</legend>
          <Field label="Points per ₹100 spent" htmlFor="l-earn" hint="Counted on the bill before GST">
            <Input id="l-earn" {...num("points_per_100")} />
          </Field>
          <Field label="Minimum bill to earn" htmlFor="l-min">
            <Input id="l-min" prefix="₹" {...num("min_order_amount")} />
          </Field>
          <Field label="Welcome bonus" htmlFor="l-wel" hint="Points when someone joins">
            <Input id="l-wel" suffix="points" {...num("welcome_bonus")} />
          </Field>
          <Field label="Points expire after" htmlFor="l-exp" hint="0 = never">
            <Input id="l-exp" suffix="months" {...num("expiry_months")} />
          </Field>
        </fieldset>
        <fieldset className="mt-5 grid gap-3 sm:grid-cols-3">
          <legend className="eyebrow mb-2">Spending</legend>
          <Field label="1 point is worth" htmlFor="l-val">
            <Input id="l-val" prefix="₹" {...num("point_value")} />
          </Field>
          <Field label="Use at least" htmlFor="l-minr">
            <Input id="l-minr" suffix="points" {...num("min_redeem_points")} />
          </Field>
          <Field label="Up to this much of a bill" htmlFor="l-max">
            <Input id="l-max" suffix="%" {...num("max_redeem_percent")} />
          </Field>
        </fieldset>
        <fieldset className="mt-5 grid gap-3 sm:grid-cols-3">
          <legend className="eyebrow mb-2">Bonus points promotion</legend>
          <Field label="Multiply points by" htmlFor="l-mult" hint="1 = no promotion">
            <Input id="l-mult" suffix="×" {...num("promo_multiplier")} />
          </Field>
          <Field label="From" htmlFor="l-pf" error={fe.promo_from}>
            <Input id="l-pf" type="date" value={s.promo_from ?? ""} disabled={!can("loyalty.manage")} onChange={(e) => set({ promo_from: e.target.value || null })} />
          </Field>
          <Field label="To" htmlFor="l-pt" error={fe.promo_to}>
            <Input id="l-pt" type="date" value={s.promo_to ?? ""} min={s.promo_from ?? undefined} disabled={!can("loyalty.manage")} onChange={(e) => set({ promo_to: e.target.value || null })} />
          </Field>
        </fieldset>
        {can("loyalty.manage") && (
          <div className="mt-5 flex justify-end gap-2">
            {dirty && (
              <Button variant="secondary" onClick={() => setS(initial)}>
                Discard
              </Button>
            )}
            <Button onClick={save} loading={busy} disabled={!dirty}>
              Save changes
            </Button>
          </div>
        )}
      </Card>
      <Card title="What customers see">
        <ul className="space-y-3 text-[14px]">
          <li>
            A <b className="num">{money(example)}</b> bill earns <b className="num">{earn} points</b>
            {s.promo_multiplier > 1 && <> (or {Math.floor(earn * s.promo_multiplier)} during the promotion)</>}, worth <b className="num">{money(earn * s.point_value)}</b> back.
          </li>
          <li>
            That&apos;s a <b className="num">{s.points_per_100 && s.point_value ? ((s.points_per_100 * s.point_value) / 100 * 100).toFixed(1) : 0}%</b> return on spend.
          </li>
          <li>
            They can start using points from <b className="num">{s.min_redeem_points}</b> points{ordersToRedeem ? <> — about {ordersToRedeem} visit{ordersToRedeem === 1 ? "" : "s"} of {money(example)}</> : null}.
          </li>
          <li>Points come back if an order is cancelled, and are taken back if a completed order is refunded.</li>
          {s.expiry_months > 0 && <li>Unused points expire {s.expiry_months} months after they were earned, oldest first.</li>}
        </ul>
      </Card>
    </div>
  );
}

/* ── Rewards ────────────────────────────────────────────────────────────── */

interface Reward {
  id: string;
  name: string;
  description: string;
  points_cost: number;
  kind: "free_item" | "discount_amount" | "discount_percent" | "gift";
  menu_item_id: string | null;
  menu_item: string | null;
  value: number | null;
  min_order: number;
  valid_from: string | null;
  valid_to: string | null;
  quantity_total: number | null;
  quantity_redeemed: number;
  redemption_valid_days: number;
  is_active: boolean;
  used: number;
  open: number;
}

const KIND_LABEL = { free_item: "Free item", discount_amount: "₹ off the bill", discount_percent: "% off the bill", gift: "Gift / experience" };

function rewardSummary(r: Pick<Reward, "kind" | "menu_item" | "value" | "min_order">) {
  const base = r.kind === "free_item" ? `Free ${r.menu_item ?? "item"}` : r.kind === "discount_amount" ? `${money(Number(r.value))} off` : r.kind === "discount_percent" ? `${Number(r.value)}% off` : "Given by staff";
  return Number(r.min_order) > 0 ? `${base} on bills over ${money(Number(r.min_order))}` : base;
}

function Rewards() {
  const { data, error, loading, reload } = useApi<{ rewards: Reward[] }>("/api/admin/rewards");
  const can = useCan();
  const [edit, setEdit] = useState<Reward | "new" | null>(null);
  return (
    <Card
      padded={false}
      title="Rewards catalogue"
      description="Shown to customers on their rewards page."
      actions={
        can("loyalty.manage") && (
          <Button size="sm" icon={<Plus size={14} />} onClick={() => setEdit("new")}>
            New reward
          </Button>
        )
      }
    >
      <ErrorBlock error={error} retry={reload} />
      {loading ? (
        <div className="p-4">
          <LoadingBlock rows={4} />
        </div>
      ) : (
        <DataTable
          rows={data?.rewards ?? []}
          rowKey={(r) => r.id}
          onRowClick={can("loyalty.manage") ? (r) => setEdit(r) : undefined}
          empty={<Empty title="No rewards yet">Create a few — a free coffee, ₹50 off, a birthday dessert — so points have something to be spent on.</Empty>}
          columns={[
            { key: "n", header: "Reward", primary: true, cell: (r) => <span className="font-semibold">{r.name} {!r.is_active && <Badge>Off</Badge>}</span> },
            { key: "w", header: "Gives", cell: (r) => rewardSummary(r) },
            { key: "p", header: "Points", align: "right", cell: (r) => <span className="num font-semibold">{r.points_cost.toLocaleString("en-IN")}</span> },
            { key: "s", header: "Stock", align: "right", hideOnCard: true, cell: (r) => (r.quantity_total === null ? <span className="text-muted">Unlimited</span> : <span className="num">{Math.max(0, r.quantity_total - r.quantity_redeemed)} left</span>) },
            { key: "u", header: "Used / open", align: "right", cell: (r) => <span className="num">{r.used} / {r.open}</span> },
            { key: "d", header: "Available", hideOnCard: true, cell: (r) => (r.valid_from || r.valid_to ? `${r.valid_from ? dateOf(r.valid_from) : "now"} – ${r.valid_to ? dateOf(r.valid_to) : "ongoing"}` : "Always") },
            { key: "e", header: <span className="sr-only">Edit</span>, align: "right", hideOnCard: true, cell: () => can("loyalty.manage") && <Pencil size={14} className="ml-auto text-muted" aria-hidden /> },
          ]}
        />
      )}
      {edit && <RewardEditor reward={edit === "new" ? null : edit} onClose={() => setEdit(null)} onSaved={reload} />}
    </Card>
  );
}

function RewardEditor({ reward, onClose, onSaved }: { reward: Reward | null; onClose: () => void; onSaved: () => void }) {
  const { data: menu } = useApi<{ items: { id: string; name: string; price: number }[] }>("/api/menu");
  const toast = useToast();
  const [f, setF] = useState({
    name: reward?.name ?? "",
    description: reward?.description ?? "",
    points_cost: String(reward?.points_cost ?? ""),
    kind: reward?.kind ?? ("free_item" as Reward["kind"]),
    menu_item_id: reward?.menu_item_id ?? "",
    value: reward?.value != null ? String(reward.value) : "",
    min_order: String(reward?.min_order ?? 0),
    valid_from: reward?.valid_from ?? "",
    valid_to: reward?.valid_to ?? "",
    limited: reward?.quantity_total != null,
    quantity_total: String(reward?.quantity_total ?? ""),
    redemption_valid_days: String(reward?.redemption_valid_days ?? 30),
    is_active: reward?.is_active ?? true,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<ClientApiError | null>(null);
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      const body = {
        name: f.name,
        description: f.description,
        points_cost: Math.floor(Number(f.points_cost)),
        kind: f.kind,
        menu_item_id: f.kind === "free_item" ? f.menu_item_id || null : null,
        value: f.kind.startsWith("discount") ? Number(f.value) || null : null,
        min_order: Number(f.min_order) || 0,
        valid_from: f.valid_from || null,
        valid_to: f.valid_to || null,
        quantity_total: f.limited ? Math.floor(Number(f.quantity_total)) : null,
        redemption_valid_days: Math.floor(Number(f.redemption_valid_days)) || 30,
        is_active: f.is_active,
      };
      if (reward) await apiFetch(`/api/admin/rewards/${reward.id}`, { method: "PATCH", body });
      else await apiFetch("/api/admin/rewards", { body });
      toast("Reward saved");
      onSaved();
      onClose();
    } catch (e) {
      setErr(e as ClientApiError);
    } finally {
      setBusy(false);
    }
  };
  const fe = err?.fields ?? {};
  const item = menu?.items.find((i) => i.id === f.menu_item_id);
  return (
    <Dialog
      open
      side
      onClose={onClose}
      title={reward ? `Edit ${reward.name}` : "New reward"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy}>
            Save
          </Button>
        </>
      }
    >
      {err && !err.fields && <Notice tone="danger" className="mb-3">{err.message}</Notice>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" htmlFor="rw-name" error={fe.name} className="sm:col-span-2">
          <Input id="rw-name" value={f.name} maxLength={60} placeholder="Free cappuccino" onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field label="Description" htmlFor="rw-desc" optional className="sm:col-span-2">
          <Textarea id="rw-desc" rows={2} maxLength={200} value={f.description} onChange={(e) => set({ description: e.target.value })} />
        </Field>
        <Field label="Type" htmlFor="rw-kind">
          <Select id="rw-kind" value={f.kind} onChange={(e) => set({ kind: e.target.value as Reward["kind"] })}>
            {Object.entries(KIND_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Costs" htmlFor="rw-pts" error={fe.points_cost}>
          <Input id="rw-pts" inputMode="numeric" suffix="points" value={f.points_cost} onChange={(e) => set({ points_cost: e.target.value.replace(/\D/g, "") })} />
        </Field>
        {f.kind === "free_item" && (
          <Field label="Free item" htmlFor="rw-item" error={fe.menu_item_id} className="sm:col-span-2" hint={item ? `Worth ${money(item.price)} — the customer adds it to their order` : undefined}>
            <Select id="rw-item" value={f.menu_item_id} onChange={(e) => set({ menu_item_id: e.target.value })}>
              <option value="">Choose…</option>
              {(menu?.items ?? []).map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {f.kind.startsWith("discount") && (
          <Field label={f.kind === "discount_amount" ? "Amount off" : "Percent off"} htmlFor="rw-val" error={fe.value}>
            <Input id="rw-val" inputMode="decimal" prefix={f.kind === "discount_amount" ? "₹" : undefined} suffix={f.kind === "discount_percent" ? "%" : undefined} value={f.value} onChange={(e) => set({ value: e.target.value.replace(/[^\d.]/g, "") })} />
          </Field>
        )}
        {f.kind !== "gift" && (
          <Field label="Minimum bill" htmlFor="rw-min" optional>
            <Input id="rw-min" prefix="₹" inputMode="decimal" value={f.min_order} onChange={(e) => set({ min_order: e.target.value.replace(/[^\d.]/g, "") })} />
          </Field>
        )}
        <Field label="Code valid for" htmlFor="rw-days" hint="After the customer redeems it">
          <Input id="rw-days" inputMode="numeric" suffix="days" value={f.redemption_valid_days} onChange={(e) => set({ redemption_valid_days: e.target.value.replace(/\D/g, "") })} />
        </Field>
        <Field label="Available from" htmlFor="rw-from" optional>
          <Input id="rw-from" type="date" value={f.valid_from} onChange={(e) => set({ valid_from: e.target.value })} />
        </Field>
        <Field label="Until" htmlFor="rw-to" optional error={fe.valid_to}>
          <Input id="rw-to" type="date" value={f.valid_to} min={f.valid_from || undefined} onChange={(e) => set({ valid_to: e.target.value })} />
        </Field>
      </div>
      <div className="mt-4 space-y-3">
        <Checkbox label="Limited quantity" checked={f.limited} onChange={(v) => set({ limited: v })} />
        {f.limited && (
          <Field label="How many in total" htmlFor="rw-qty" error={fe.quantity_total} hint={reward ? `${reward.quantity_redeemed} redeemed so far` : undefined}>
            <Input id="rw-qty" inputMode="numeric" value={f.quantity_total} onChange={(e) => set({ quantity_total: e.target.value.replace(/\D/g, "") })} />
          </Field>
        )}
        <Checkbox label="Active" hint="Inactive rewards are hidden from customers. Codes already issued still work." checked={f.is_active} onChange={(v) => set({ is_active: v })} />
      </div>
    </Dialog>
  );
}

/* ── Redemptions ────────────────────────────────────────────────────────── */

interface Redemption {
  id: string;
  code: string;
  status: string;
  points: number;
  expires_at: string;
  used_at: string | null;
  created_at: string;
  reward: string;
  customer: string;
  phone: string | null;
  order_number: number | null;
  lapsed: boolean;
}

function Redemptions() {
  const [status, setStatus] = useState("");
  const [code, setCode] = useState("");
  const [lookup, setLookup] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setLookup(code.trim().toUpperCase()), 300);
    return () => clearTimeout(t);
  }, [code]);
  const { data, error, loading, reload } = useApi<{ redemptions: Redemption[] }>(`/api/admin/redemptions${qs({ status: status || undefined, code: lookup.length >= 6 ? lookup : undefined })}`);
  const can = useCan();
  const toast = useToast();
  const { ask, node } = useConfirm();
  const cancel = async (r: Redemption) => {
    const res = await ask({ title: `Cancel ${r.reward} for ${r.customer}?`, body: `${r.points} points go back to the customer and the code stops working.`, reason: { label: "Why?", required: true }, confirm: "Cancel reward", danger: true });
    if (!res.ok) return;
    try {
      await apiFetch(`/api/admin/redemptions/${r.id}`, { body: { action: "cancel", reason: res.reason } });
      toast("Reward cancelled, points returned");
      reload();
    } catch (e) {
      toast((e as ClientApiError).message, "error");
    }
  };
  return (
    <Card padded={false}>
      {node}
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
        <div className="relative min-w-[200px] flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <Input aria-label="Look up a code" className="pl-9 uppercase" placeholder="Look up a code, e.g. NR-7KQ2MX" value={code} onChange={(e) => setCode(e.target.value)} />
        </div>
        <Select aria-label="Status" className="w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All</option>
          <option value="issued">Ready to use</option>
          <option value="used">Used</option>
          <option value="expired">Expired</option>
          <option value="cancelled">Cancelled</option>
        </Select>
      </div>
      <ErrorBlock error={error} retry={reload} />
      {loading ? (
        <div className="p-4">
          <LoadingBlock rows={4} />
        </div>
      ) : (
        <DataTable
          rows={data?.redemptions ?? []}
          rowKey={(r) => r.id}
          empty={<Empty title={lookup ? "No reward with that code" : "No rewards redeemed yet"} />}
          columns={[
            { key: "c", header: "Code", primary: true, cell: (r) => <span className="num font-semibold">{r.code}</span> },
            { key: "r", header: "Reward", cell: (r) => r.reward },
            { key: "cu", header: "Customer", cell: (r) => r.customer },
            { key: "w", header: "Redeemed", hideOnCard: true, cell: (r) => dateTime(r.created_at) },
            {
              key: "s",
              header: "Status",
              cell: (r) =>
                r.status === "issued" && !r.lapsed ? (
                  <Badge tone="primary">Valid till {dateOf(r.expires_at)}</Badge>
                ) : r.status === "used" ? (
                  <Badge tone="success">Used{r.order_number ? ` · #${r.order_number}` : ""}</Badge>
                ) : (
                  <Badge>{r.lapsed ? "Expired" : r.status[0].toUpperCase() + r.status.slice(1)}</Badge>
                ),
            },
            {
              key: "x",
              header: <span className="sr-only">Actions</span>,
              align: "right",
              hideOnCard: true,
              cell: (r) =>
                r.status === "issued" &&
                !r.lapsed &&
                can("loyalty.manage") && (
                  <Button size="sm" variant="ghost" onClick={() => cancel(r)}>
                    Cancel
                  </Button>
                ),
            },
          ]}
        />
      )}
    </Card>
  );
}
