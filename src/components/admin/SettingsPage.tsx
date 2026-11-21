"use client";

import { useState } from "react";
import { Card, Checkbox, ErrorBlock, Field, Input, LoadingBlock, Notice, PageHeader, Switch, Textarea, Button, useToast } from "./ui";
import { useCan } from "./AdminShell";
import { apiFetch, useApi, type ClientApiError } from "@/lib/api-client";
import { money } from "@/lib/format";

interface Settings {
  business: { name: string; tagline: string; address: string; phone: string; email: string; gstin: string; timezone: string };
  tax: { gst_percent: number; service_charge_percent: number };
  ordering: { accepting_orders: boolean; takeaway_enabled: boolean; closed_message: string };
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
          <TaxCard initial={data.tax} onSaved={reload} />
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
      <div className="mt-3">
        <Checkbox label="Allow takeaway orders online" checked={s.v.takeaway_enabled} onChange={(v) => s.setV({ ...s.v, takeaway_enabled: v })} />
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
