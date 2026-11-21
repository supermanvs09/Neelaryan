"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, Cake, Download, Gift, Pencil, Plus, Search } from "lucide-react";
import { Badge, Button, Card, Checkbox, DataTable, Dialog, Empty, ErrorBlock, Field, Input, LoadingBlock, Notice, PageHeader, Segmented, Select, Stat, Tabs, Textarea, useToast } from "../ui";
import { useCan } from "../AdminShell";
import { apiFetch, qs, useApi, type ClientApiError } from "@/lib/api-client";
import { ago, dateOf, dateTime, money } from "@/lib/format";
import { clsx } from "@/lib/clsx";

interface CustomerRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  dob: string | null;
  marketing_consent: boolean;
  unsubscribed_at: string | null;
  points_balance: number;
  visits: number;
  total_spent: number;
  last_order_at: string | null;
  created_at: string;
  phone_verified: boolean;
  source: string;
}

const birthdayLabel = (dob: string | null) => (dob ? new Date(`${dob}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }) : null);

export function CustomersPage() {
  const can = useCan();
  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");
  const [segment, setSegment] = useState<"all" | "subscribed" | "birthday_month" | "inactive" | "top">("all");
  const [sort, setSort] = useState("recent");
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setQ(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);
  const params = { q: q || undefined, segment, sort };
  const { data, error, loading, reload } = useApi<{ customers: CustomerRow[]; total: number; stats: { total: number; subscribed: number; new_30d: number; active_30d: number; points_outstanding: number } }>(`/api/admin/customers${qs(params)}`);

  return (
    <>
      <PageHeader
        title="Customers"
        description="Members who signed up for rewards, and customers added at the counter."
        actions={
          <>
            {can("customers.manage") && (
              <a href={`/api/admin/customers${qs({ ...params, format: "csv" })}`}>
                <Button variant="secondary" icon={<Download size={15} />}>
                  Export
                </Button>
              </a>
            )}
            {can("customers.manage") && (
              <Button icon={<Plus size={16} />} onClick={() => setAdding(true)}>
                Add customer
              </Button>
            )}
          </>
        }
      />
      {data && (
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Customers" value={data.stats.total} sub={`${data.stats.new_30d} joined in 30 days`} />
          <Stat label="Ordered in 30 days" value={data.stats.active_30d} />
          <Stat label="Accept offers" value={data.stats.subscribed} sub="Opted in to messages" />
          <Stat label="Points outstanding" value={data.stats.points_outstanding.toLocaleString("en-IN")} />
        </div>
      )}
      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <div className="relative min-w-[200px] flex-1">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
            <Input aria-label="Search customers" className="pl-9" placeholder="Name, mobile or email" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <Segmented
            label="Show"
            value={segment}
            onChange={setSegment}
            items={[
              { value: "all", label: "All" },
              { value: "subscribed", label: "Opted in" },
              { value: "birthday_month", label: "Birthdays" },
              { value: "top", label: "Regulars" },
              { value: "inactive", label: "Lapsed" },
            ]}
          />
          <Select aria-label="Sort" className="w-auto" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="recent">Last visit</option>
            <option value="spent">Most spent</option>
            <option value="visits">Most visits</option>
            <option value="points">Most points</option>
            <option value="name">Name</option>
          </Select>
        </div>
        <ErrorBlock error={error} retry={reload} />
        {loading ? (
          <div className="p-4">
            <LoadingBlock rows={6} />
          </div>
        ) : (
          <DataTable
            rows={data?.customers ?? []}
            rowKey={(c) => c.id}
            onRowClick={(c) => setOpen(c.id)}
            empty={
              <Empty title={q || segment !== "all" ? "No customers match" : "No customers yet"}>
                {q || segment !== "all" ? "Try a different search or filter." : "Customers appear here when they join rewards after ordering, or when you add them at the counter."}
              </Empty>
            }
            columns={[
              {
                key: "n",
                header: "Customer",
                primary: true,
                cell: (c) => (
                  <span className="flex items-center gap-1.5">
                    <span className="font-semibold">{c.name}</span>
                    {c.phone_verified && <BadgeCheck size={14} className="text-primary" aria-label="Mobile verified" />}
                  </span>
                ),
              },
              { key: "p", header: "Mobile", cell: (c) => <span className="num">{c.phone ?? "—"}</span> },
              { key: "v", header: "Visits", align: "right", cell: (c) => <span className="num">{c.visits}</span> },
              { key: "s", header: "Spent", align: "right", cell: (c) => <span className="num">{money(Number(c.total_spent))}</span> },
              { key: "pt", header: "Points", align: "right", cell: (c) => <span className="num font-semibold">{c.points_balance.toLocaleString("en-IN")}</span> },
              { key: "l", header: "Last visit", cell: (c) => (c.last_order_at ? ago(c.last_order_at) : <span className="text-muted">Never</span>) },
              {
                key: "b",
                header: "Birthday",
                hideOnCard: true,
                cell: (c) =>
                  c.dob ? (
                    <span className="inline-flex items-center gap-1">
                      <Cake size={13} className="text-muted" aria-hidden />
                      {birthdayLabel(c.dob)}
                    </span>
                  ) : (
                    <span className="text-muted">—</span>
                  ),
              },
              { key: "m", header: "Offers", hideOnCard: true, cell: (c) => (c.marketing_consent && !c.unsubscribed_at ? <Badge tone="success">Opted in</Badge> : <span className="text-muted">No</span>) },
            ]}
          />
        )}
        {data && data.total > (data.customers.length ?? 0) && <p className="border-t border-line px-4 py-2 text-[13px] text-muted">Showing {data.customers.length} of {data.total}. Search to find others.</p>}
      </Card>
      {open && <CustomerDrawer id={open} onClose={() => setOpen(null)} onChanged={reload} />}
      {adding && <AddCustomer onClose={() => setAdding(false)} onSaved={(id) => { reload(); setOpen(id); }} />}
    </>
  );
}

function AddCustomer({ onClose, onSaved }: { onClose: () => void; onSaved: (id: string) => void }) {
  const toast = useToast();
  const [f, setF] = useState({ name: "", phone: "", email: "", dob: "", notes: "", marketing_consent: false });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<ClientApiError | null>(null);
  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await apiFetch<{ id: string; existing: boolean; name?: string }>("/api/admin/customers", { body: f });
      toast(r.existing ? `${r.name} is already a customer — opened their record` : "Customer added");
      onSaved(r.id);
      onClose();
    } catch (e) {
      setErr(e as ClientApiError);
    } finally {
      setBusy(false);
    }
  };
  const fe = err?.fields ?? {};
  return (
    <Dialog
      open
      onClose={onClose}
      title="Add customer"
      description="Their number isn't verified until they sign in with a code themselves."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy} disabled={f.name.trim().length < 2 || f.phone.length !== 10}>
            Add
          </Button>
        </>
      }
    >
      {err && !err.fields && <Notice tone="danger" className="mb-3">{err.message}</Notice>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" htmlFor="ac-name" error={fe.name}>
          <Input id="ac-name" value={f.name} maxLength={40} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="Mobile" htmlFor="ac-phone" error={fe.phone}>
          <Input id="ac-phone" inputMode="numeric" prefix="+91" value={f.phone} maxLength={10} onChange={(e) => setF({ ...f, phone: e.target.value.replace(/\D/g, "") })} />
        </Field>
        <Field label="Email" htmlFor="ac-email" optional error={fe.email}>
          <Input id="ac-email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </Field>
        <Field label="Date of birth" htmlFor="ac-dob" optional error={fe.dob}>
          <Input id="ac-dob" type="date" value={f.dob} onChange={(e) => setF({ ...f, dob: e.target.value })} />
        </Field>
        <Field label="Notes" htmlFor="ac-notes" optional className="sm:col-span-2">
          <Textarea id="ac-notes" rows={2} maxLength={500} value={f.notes} placeholder="Allergies, preferences…" onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>
      </div>
      <div className="mt-3">
        <Checkbox label="The customer agreed to receive offers and birthday messages" hint="Only tick this if they said yes just now. It's recorded with your name." checked={f.marketing_consent} onChange={(v) => setF({ ...f, marketing_consent: v })} />
      </div>
    </Dialog>
  );
}

interface Detail {
  customer: CustomerRow & { notes: string; consent_at: string | null; consent_source: string; lifetime_points: number; is_active: boolean; phone_verified_at: string | null; email_verified_at: string | null };
  orders: { id: string; number: number; type: string; status: string; payment_status: string; total: number; created_at: string; table_label: string | null }[];
  points: { id: number; kind: string; points: number; remaining: number; note: string; expires_at: string | null; created_at: string; order_number: number | null; by: string | null }[];
  redemptions: { id: string; code: string; status: string; points: number; expires_at: string; used_at: string | null; created_at: string; name: string; order_number: number | null }[];
  messages: { id: number; kind: string; channel: string; subject: string; status: string; created_at: string }[];
}

const KIND: Record<string, string> = { earn: "Earned", promo: "Bonus", adjust: "Adjusted", redeem: "Reward", expire: "Expired", reverse: "Refund reversal", restore: "Returned" };

function CustomerDrawer({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const { data, error, loading, reload } = useApi<Detail>(`/api/admin/customers/${id}`);
  const can = useCan();
  const [tab, setTab] = useState<"orders" | "points" | "rewards" | "messages">("orders");
  const [mode, setMode] = useState<null | "edit" | "points" | "reward">(null);
  const c = data?.customer;
  const done = () => {
    setMode(null);
    reload();
    onChanged();
  };
  return (
    <Dialog
      open
      side
      size="lg"
      onClose={onClose}
      title={c?.name ?? "Customer"}
      description={c ? [c.phone, c.email].filter(Boolean).join(" · ") : undefined}
      footer={
        c && (
          <>
            {can("customers.manage") && (
              <Button variant="ghost" className="mr-auto" icon={<Pencil size={14} />} onClick={() => setMode("edit")}>
                Edit
              </Button>
            )}
            {can("loyalty.manage") && (
              <Button variant="secondary" onClick={() => setMode("points")}>
                Adjust points
              </Button>
            )}
            {(can("loyalty.manage") || can("billing.manage")) && (
              <Button icon={<Gift size={14} />} onClick={() => setMode("reward")}>
                Redeem reward
              </Button>
            )}
          </>
        )
      }
    >
      <ErrorBlock error={error} retry={reload} />
      {loading || !data || !c ? (
        <LoadingBlock rows={6} />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MiniStat label="Points" value={c.points_balance.toLocaleString("en-IN")} />
            <MiniStat label="Visits" value={String(c.visits)} />
            <MiniStat label="Spent" value={money(Number(c.total_spent))} />
            <MiniStat label="Customer since" value={dateOf(c.created_at)} />
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-line p-3 text-[13.5px]">
            <dt className="text-muted">Mobile</dt>
            <dd>{c.phone ?? "—"} {c.phone_verified_at ? <Badge tone="success">Verified</Badge> : c.phone ? <Badge>Not verified</Badge> : null}</dd>
            <dt className="text-muted">Birthday</dt>
            <dd>{birthdayLabel(c.dob) ?? "—"}</dd>
            <dt className="text-muted">Offers & birthday messages</dt>
            <dd>
              {c.marketing_consent && !c.unsubscribed_at ? (
                <>
                  <Badge tone="success">Opted in</Badge>
                  <span className="block text-[12px] text-muted">
                    {c.consent_at && dateOf(c.consent_at)} · {c.consent_source}
                  </span>
                </>
              ) : c.unsubscribed_at ? (
                `Unsubscribed ${dateOf(c.unsubscribed_at)}`
              ) : (
                "Not opted in"
              )}
            </dd>
            {c.notes && (
              <>
                <dt className="text-muted">Notes</dt>
                <dd className="whitespace-pre-line">{c.notes}</dd>
              </>
            )}
          </dl>
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              { value: "orders", label: `Orders (${data.orders.length})` },
              { value: "points", label: "Points" },
              { value: "rewards", label: `Rewards (${data.redemptions.length})` },
              { value: "messages", label: "Messages" },
            ]}
          />
          {tab === "orders" &&
            (data.orders.length ? (
              <ul className="divide-y divide-line rounded-lg border border-line text-[13.5px]">
                {data.orders.map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <span>
                      <b>#{o.number}</b> <span className="text-muted">· {dateTime(o.created_at)} · {o.type === "dine_in" ? `Table ${o.table_label ?? ""}` : "Takeaway"}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="capitalize text-muted">{o.status}</span>
                      <span className="num font-semibold">{money(Number(o.total))}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13.5px] text-muted">No orders yet.</p>
            ))}
          {tab === "points" &&
            (data.points.length ? (
              <ul className="divide-y divide-line rounded-lg border border-line text-[13.5px]">
                {data.points.map((p) => (
                  <li key={p.id} className="flex items-start justify-between gap-2 px-3 py-2">
                    <span>
                      <b>{KIND[p.kind] ?? p.kind}</b>
                      <span className="text-muted">
                        {" "}
                        · {dateTime(p.created_at)}
                        {p.note && ` · ${p.note}`}
                        {p.by && ` · by ${p.by}`}
                        {p.points > 0 && p.expires_at && p.remaining > 0 && ` · ${p.remaining} expire ${dateOf(p.expires_at)}`}
                      </span>
                    </span>
                    <span className={clsx("num shrink-0 font-semibold", p.points < 0 ? "text-danger" : "text-success")}>
                      {p.points > 0 && "+"}
                      {p.points}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13.5px] text-muted">No points activity yet.</p>
            ))}
          {tab === "rewards" &&
            (data.redemptions.length ? (
              <ul className="divide-y divide-line rounded-lg border border-line text-[13.5px]">
                {data.redemptions.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <span>
                      <b>{r.name}</b> <span className="num text-muted">· {r.code}</span>
                      <span className="block text-[12px] text-muted">
                        {r.points} points · {dateOf(r.created_at)}
                        {r.order_number && ` · used on #${r.order_number}`}
                        {r.status === "issued" && ` · valid till ${dateOf(r.expires_at)}`}
                      </span>
                    </span>
                    <Badge tone={r.status === "issued" ? "primary" : r.status === "used" ? "success" : "neutral"}>{r.status === "issued" ? "Ready to use" : r.status[0].toUpperCase() + r.status.slice(1)}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13.5px] text-muted">No rewards redeemed yet.</p>
            ))}
          {tab === "messages" &&
            (data.messages.length ? (
              <ul className="divide-y divide-line rounded-lg border border-line text-[13.5px]">
                {data.messages.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <span>
                      <b className="capitalize">{m.kind}</b> <span className="text-muted">· {m.channel.toUpperCase()} · {dateTime(m.created_at)}</span>
                    </span>
                    <span className="capitalize text-muted">{m.status}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13.5px] text-muted">No messages sent.</p>
            ))}
        </div>
      )}
      {c && mode === "edit" && <EditCustomer c={c} onClose={() => setMode(null)} onDone={done} />}
      {c && mode === "points" && <PointsDialog c={c} onClose={() => setMode(null)} onDone={done} />}
      {c && mode === "reward" && <RewardDialog c={c} onClose={() => setMode(null)} onDone={done} />}
    </Dialog>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line px-3 py-2">
      <p className="text-[12px] text-muted">{label}</p>
      <p className="num text-[16px] font-semibold">{value}</p>
    </div>
  );
}

function EditCustomer({ c, onClose, onDone }: { c: Detail["customer"]; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ name: c.name, email: c.email ?? "", dob: c.dob ?? "", notes: c.notes, withdraw_consent: false, is_active: c.is_active });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<ClientApiError | null>(null);
  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      await apiFetch(`/api/admin/customers/${c.id}`, { method: "PATCH", body: f });
      toast("Customer updated");
      onDone();
    } catch (e) {
      setErr(e as ClientApiError);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Edit ${c.name}`}
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
      {err && <Notice tone="danger" className="mb-3">{err.message}</Notice>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" htmlFor="ec-name">
          <Input id="ec-name" value={f.name} maxLength={40} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="Email" htmlFor="ec-email" optional>
          <Input id="ec-email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </Field>
        <Field label="Date of birth" htmlFor="ec-dob" optional>
          <Input id="ec-dob" type="date" value={f.dob} onChange={(e) => setF({ ...f, dob: e.target.value })} />
        </Field>
        <Field label="Notes" htmlFor="ec-notes" optional className="sm:col-span-2">
          <Textarea id="ec-notes" rows={2} maxLength={500} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>
      </div>
      <div className="mt-3 space-y-3">
        {c.marketing_consent && !c.unsubscribed_at && (
          <Checkbox label="Stop sending offers to this customer" hint="Use when they ask you in person. Only they can opt back in." checked={f.withdraw_consent} onChange={(v) => setF({ ...f, withdraw_consent: v })} />
        )}
        <Checkbox label="Active" hint="Closed accounts can't sign in or earn points." checked={f.is_active} onChange={(v) => setF({ ...f, is_active: v })} />
      </div>
    </Dialog>
  );
}

function PointsDialog({ c, onClose, onDone }: { c: Detail["customer"]; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [dir, setDir] = useState<"add" | "remove">("add");
  const [points, setPoints] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<ClientApiError | null>(null);
  const n = Math.floor(Number(points) || 0);
  const go = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await apiFetch<{ balance: number }>(`/api/admin/customers/${c.id}/points`, { body: { points: dir === "add" ? n : -n, kind: dir === "add" ? "promo" : "adjust", note } });
      toast(`New balance: ${r.balance} points`);
      onDone();
    } catch (e) {
      setErr(e as ClientApiError);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open
      size="sm"
      onClose={onClose}
      title="Adjust points"
      description={`Balance: ${c.points_balance} points`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={go} loading={busy} disabled={n <= 0 || note.trim().length < 3 || (dir === "remove" && n > c.points_balance)}>
            {dir === "add" ? `Add ${n || ""} points` : `Remove ${n || ""} points`}
          </Button>
        </>
      }
    >
      {err && <Notice tone="danger" className="mb-3">{err.message}</Notice>}
      <Segmented label="Add or remove" value={dir} onChange={setDir} items={[{ value: "add", label: "Add" }, { value: "remove", label: "Remove" }]} />
      <Field label="Points" htmlFor="pd-pts" className="mt-3">
        <Input id="pd-pts" inputMode="numeric" value={points} onChange={(e) => setPoints(e.target.value.replace(/\D/g, ""))} />
      </Field>
      <Field label="Reason" htmlFor="pd-note" className="mt-3" hint="Shown in the customer's points history and the audit log.">
        <Input id="pd-note" value={note} maxLength={200} placeholder={dir === "add" ? "Sorry for the wait" : "Correction"} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </Dialog>
  );
}

function RewardDialog({ c, onClose, onDone }: { c: Detail["customer"]; onClose: () => void; onDone: () => void }) {
  const { data } = useApi<{ rewards: { id: string; name: string; points_cost: number; is_active: boolean; quantity_total: number | null; quantity_redeemed: number }[] }>("/api/admin/rewards");
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [err, setErr] = useState<ClientApiError | null>(null);
  const go = async (rid: string) => {
    setBusy(rid);
    setErr(null);
    try {
      const r = await apiFetch<{ code: string; reward: string }>(`/api/admin/customers/${c.id}/rewards`, { body: { reward_id: rid } });
      setCode(r.code);
      toast(`${r.reward} redeemed`);
    } catch (e) {
      setErr(e as ClientApiError);
    } finally {
      setBusy(null);
    }
  };
  const rewards = (data?.rewards ?? []).filter((r) => r.is_active);
  return (
    <Dialog open size="sm" onClose={code ? onDone : onClose} title="Redeem a reward" description={`${c.points_balance} points available`}>
      {err && <Notice tone="danger" className="mb-3">{err.message}</Notice>}
      {code ? (
        <div className="text-center">
          <p className="text-[14px] text-muted">Apply this code to the customer&apos;s order:</p>
          <p className="num my-3 text-[28px] font-bold tracking-wider">{code}</p>
          <Button onClick={onDone}>Done</Button>
        </div>
      ) : !rewards.length ? (
        <Empty title="No rewards set up">Create rewards in Loyalty & rewards.</Empty>
      ) : (
        <ul className="space-y-2">
          {rewards.map((r) => {
            const out = r.quantity_total !== null && r.quantity_redeemed >= r.quantity_total;
            return (
              <li key={r.id} className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2">
                <span>
                  <b>{r.name}</b>
                  <span className="block text-[12.5px] text-muted">{r.points_cost} points{out && " · none left"}</span>
                </span>
                <Button size="sm" loading={busy === r.id} disabled={out || r.points_cost > c.points_balance} onClick={() => go(r.id)}>
                  Redeem
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </Dialog>
  );
}
