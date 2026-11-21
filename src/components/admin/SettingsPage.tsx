"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Copy, MonitorSmartphone } from "lucide-react";
import { upiLink } from "@/lib/shop/push";
import { Card, Checkbox, ErrorBlock, Field, Input, LoadingBlock, Notice, PageHeader, Switch, Textarea, Button, useToast } from "./ui";
import { useCan } from "./AdminShell";
import { apiFetch, useApi, type ClientApiError } from "@/lib/api-client";
import { money } from "@/lib/format";

interface Settings {
  business: { name: string; tagline: string; address: string; phone: string; email: string; gstin: string; timezone: string };
  tax: { gst_percent: number; service_charge_percent: number };
  ordering: { accepting_orders: boolean; takeaway_enabled: boolean; closed_message: string; preorders_enabled: boolean; show_wait_time: boolean };
  payments: { cash_enabled: boolean; upi_enabled: boolean; upi_id: string; upi_payee_name: string };
}

function useSection<K extends keyof Settings>(section: K, initial: Settings[K], onSaved: () => void) {
  const toast = useToast();
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<ClientApiError | null>(null);
  const save = async (next = v) => {
    setBusy(true);
    setErr(null);
    try {
      await apiFetch("/api/admin/settings", { method: "PUT", body: { section, value: next } });
      toast("Saved");
      onSaved();
    } catch (e) {
      setErr(e as ClientApiError);
    } finally {
      setBusy(false);
    }
  };
  return { v, setV, busy, err, save, dirty: JSON.stringify(v) !== JSON.stringify(initial) };
}

export function SettingsPage() {
  const { data, error, loading, reload } = useApi<Settings>("/api/admin/settings");
  return (
    <>
      <PageHeader title="Settings" description="Business details, tax and online ordering." />
      <ErrorBlock error={error} retry={reload} />
      {loading || !data ? (
        <LoadingBlock rows={6} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <OrderingCard initial={data.ordering} onSaved={reload} />
          <PaymentsCard initial={data.payments} onSaved={reload} />
          <TaxCard initial={data.tax} onSaved={reload} />
          <KitchenLinkCard />
          <BusinessCard initial={data.business} onSaved={reload} />
        </div>
      )}
    </>
  );
}

function OrderingCard({ initial, onSaved }: { initial: Settings["ordering"]; onSaved: () => void }) {
  const s = useSection("ordering", initial, onSaved);
  return (
    <Card title="Online ordering" description="QR table orders and takeaway from the website.">
      {s.err && <Notice tone="danger" className="mb-3">{s.err.message}</Notice>}
      <div className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-3">
        <div>
          <p className="font-semibold">{s.v.accepting_orders ? "Taking orders" : "Orders paused"}</p>
          <p className="text-[13px] text-muted">{s.v.accepting_orders ? "Guests can order from their phones." : "Guests see your message instead of the order button."}</p>
        </div>
        <Switch
          label="Accepting orders"
          checked={s.v.accepting_orders}
          disabled={s.busy}
          onChange={(on) => {
            const next = { ...s.v, accepting_orders: on };
            s.setV(next);
            s.save(next);
          }}
        />
      </div>
      <div className="mt-3 space-y-2">
        <Checkbox label="Allow takeaway orders online" checked={s.v.takeaway_enabled} onChange={(v) => s.setV({ ...s.v, takeaway_enabled: v })} />
        <Checkbox label="Allow takeaway pre-orders for later today" hint="Guests pick a pickup time; the kitchen sees the order 15 minutes before." checked={s.v.preorders_enabled} disabled={!s.v.takeaway_enabled} onChange={(v) => s.setV({ ...s.v, preorders_enabled: v })} />
        <Checkbox label="Show the expected wait time" hint="Worked out from recent kitchen times and how many orders are waiting." checked={s.v.show_wait_time} onChange={(v) => s.setV({ ...s.v, show_wait_time: v })} />
      </div>
      <Field label="Message when paused" htmlFor="set-closed" className="mt-3" error={s.err?.fields?.["value.closed_message"]}>
        <Textarea id="set-closed" rows={2} maxLength={200} value={s.v.closed_message} onChange={(e) => s.setV({ ...s.v, closed_message: e.target.value })} />
      </Field>
      <div className="mt-4 flex justify-end">
        <Button onClick={() => s.save()} loading={s.busy} disabled={!s.dirty}>
          Save
        </Button>
      </div>
    </Card>
  );
}

function TaxCard({ initial, onSaved }: { initial: Settings["tax"]; onSaved: () => void }) {
  const can = useCan();
  const s = useSection("tax", initial, onSaved);
  const disabled = !can("settings.manage");
  const ex = 200;
  const svc = (ex * s.v.service_charge_percent) / 100;
  const gst = ((ex + svc) * s.v.gst_percent) / 100;
  return (
    <Card title="Tax & charges" description="Applied to new orders. Past bills keep the rates they were made with.">
      {s.err && <Notice tone="danger" className="mb-3">{s.err.message}</Notice>}
      <div className="grid grid-cols-2 gap-3">
        <Field label="GST" htmlFor="set-gst" hint="5% for most restaurants">
          <Input id="set-gst" inputMode="decimal" suffix="%" disabled={disabled} value={String(s.v.gst_percent)} onChange={(e) => s.setV({ ...s.v, gst_percent: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 })} />
        </Field>
        <Field label="Service charge" htmlFor="set-svc" hint="Optional; shown on the bill">
          <Input id="set-svc" inputMode="decimal" suffix="%" disabled={disabled} value={String(s.v.service_charge_percent)} onChange={(e) => s.setV({ ...s.v, service_charge_percent: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 })} />
        </Field>
      </div>
      <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-[13px]">
        A {money(ex)} order → {svc > 0 && <>service {money(svc)} + </>}GST {money(gst)} = <b className="num">{money(ex + svc + gst)}</b>
      </p>
      {!disabled && (
        <div className="mt-4 flex justify-end">
          <Button onClick={() => s.save()} loading={s.busy} disabled={!s.dirty}>
            Save
          </Button>
        </div>
      )}
    </Card>
  );
}

function BusinessCard({ initial, onSaved }: { initial: Settings["business"]; onSaved: () => void }) {
  const can = useCan();
  const s = useSection("business", initial, onSaved);
  const disabled = !can("settings.manage");
  const fe = s.err?.fields ?? {};
  const f = (k: keyof Settings["business"]) => ({ value: s.v[k], disabled, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => s.setV({ ...s.v, [k]: e.target.value }) });
  return (
    <Card title="Business details" description="Printed on bills and used in messages." className="lg:col-span-2">
      {s.err && !s.err.fields && <Notice tone="danger" className="mb-3">{s.err.message}</Notice>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Café name" htmlFor="b-name" error={fe["value.name"]}>
          <Input id="b-name" maxLength={60} {...f("name")} />
        </Field>
        <Field label="Tagline" htmlFor="b-tag" optional>
          <Input id="b-tag" maxLength={120} {...f("tagline")} />
        </Field>
        <Field label="Phone" htmlFor="b-phone" optional>
          <Input id="b-phone" maxLength={20} {...f("phone")} />
        </Field>
        <Field label="Email" htmlFor="b-email" optional error={fe["value.email"]}>
          <Input id="b-email" type="email" {...f("email")} />
        </Field>
        <Field label="GSTIN" htmlFor="b-gst" optional error={fe["value.gstin"]}>
          <Input id="b-gst" maxLength={15} {...f("gstin")} />
        </Field>
        <Field label="Address" htmlFor="b-addr" optional className="sm:col-span-2">
          <Textarea id="b-addr" rows={2} maxLength={300} {...f("address")} />
        </Field>
      </div>
      {!disabled && (
        <div className="mt-4 flex justify-end">
          <Button onClick={() => s.save()} loading={s.busy} disabled={!s.dirty}>
            Save
          </Button>
        </div>
      )}
    </Card>
  );
}

function PaymentsCard({ initial, onSaved }: { initial: Settings["payments"]; onSaved: () => void }) {
  const s = useSection("payments", initial, onSaved);
  const can = useCan();
  const [qr, setQr] = useState<string | null>(null);
  const validId = /^[A-Za-z0-9._-]{2,64}@[A-Za-z][A-Za-z0-9]{1,63}$/.test(s.v.upi_id.trim());
  useEffect(() => {
    if (!validId) return setQr(null);
    QRCode.toDataURL(upiLink(s.v.upi_id.trim(), s.v.upi_payee_name || "Test", 1, "Test payment"), { margin: 1, width: 240 }).then(setQr, () => setQr(null));
  }, [s.v.upi_id, s.v.upi_payee_name, validId]);
  const disabled = !can("settings.manage");
  return (
    <Card title="Payments" description="How guests can pay for orders they place from their phone. Staff can always record cash, UPI or card at the counter.">
      {s.err && <Notice tone="danger" className="mb-3">{s.err.message}</Notice>}
      <div className="space-y-2">
        <Checkbox label="Pay at the counter / in cash" checked={s.v.cash_enabled} disabled={disabled} onChange={(v) => s.setV({ ...s.v, cash_enabled: v })} />
        <Checkbox label="Pay by UPI from their phone" hint="Guests get a QR and a button that opens their UPI app with the exact amount. They tap “I've paid” and staff confirm it on the order." checked={s.v.upi_enabled} disabled={disabled} onChange={(v) => s.setV({ ...s.v, upi_enabled: v })} />
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="UPI ID" htmlFor="set-upi" error={s.err?.fields?.["value.upi_id"]} hint="e.g. neelaryan@okaxis">
          <Input id="set-upi" value={s.v.upi_id} disabled={disabled} autoComplete="off" onChange={(e) => s.setV({ ...s.v, upi_id: e.target.value })} />
        </Field>
        <Field label="Payee name" htmlFor="set-payee" hint="Shown in the guest's UPI app">
          <Input id="set-payee" value={s.v.upi_payee_name} maxLength={50} disabled={disabled} onChange={(e) => s.setV({ ...s.v, upi_payee_name: e.target.value })} />
        </Field>
      </div>
      {qr && (
        <div className="mt-3 flex items-center gap-3 rounded-lg border border-line p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="Test UPI QR for ₹1" className="h-[96px] w-[96px] rounded bg-[#fff] p-1" />
          <p className="text-[13px] text-muted">Test before you switch it on: scan this with any UPI app — it should show <b className="text-fg">{s.v.upi_payee_name || "your name"}</b> and ₹1.00. You don&apos;t need to complete the payment.</p>
        </div>
      )}
      {!disabled && (
        <div className="mt-4 flex justify-end">
          <Button onClick={() => s.save()} loading={s.busy} disabled={!s.dirty}>
            Save
          </Button>
        </div>
      )}
    </Card>
  );
}

function KitchenLinkCard() {
  const can = useCan();
  const toast = useToast();
  const { data, reload } = useApi<{ enabled: boolean; url: string | null }>(can("settings.manage") ? "/api/admin/kitchen-link" : null);
  const [busy, setBusy] = useState<string | null>(null);
  if (!can("settings.manage")) return null;
  const act = async (action: "enable" | "reset" | "disable") => {
    if (action === "reset" && !confirm("Make a new link? The old link stops working straight away.")) return;
    setBusy(action);
    try {
      await apiFetch("/api/admin/kitchen-link", { body: { action } });
      toast(action === "disable" ? "Kitchen link turned off" : action === "reset" ? "New kitchen link made" : "Kitchen link on");
      await reload();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  };
  return (
    <Card title="Kitchen screen link" description="A secret link for a kitchen tablet: shows the kitchen board without signing in. Cooks can only accept, start and mark orders ready — no prices, phone numbers or money.">
      {data?.enabled && data.url ? (
        <>
          <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-2/50 p-2">
            <MonitorSmartphone size={16} className="shrink-0 text-muted" aria-hidden />
            <code className="min-w-0 flex-1 truncate text-[12.5px]">{data.url}</code>
            <Button size="sm" variant="secondary" icon={<Copy size={14} />} onClick={() => navigator.clipboard?.writeText(data.url!).then(() => toast("Link copied"), () => undefined)}>
              Copy
            </Button>
          </div>
          <p className="mt-2 text-[12.5px] text-muted">Anyone with this link can see and move kitchen orders. If it gets shared by mistake, make a new one.</p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" className="text-danger" loading={busy === "disable"} onClick={() => act("disable")}>
              Turn off
            </Button>
            <Button variant="secondary" loading={busy === "reset"} onClick={() => act("reset")}>
              Make a new link
            </Button>
          </div>
        </>
      ) : (
        <div className="flex justify-end">
          <Button loading={busy === "enable"} onClick={() => act("enable")}>
            Turn on kitchen link
          </Button>
        </div>
      )}
    </Card>
  );
}
