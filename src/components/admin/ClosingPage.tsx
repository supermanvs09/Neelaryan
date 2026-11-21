"use client";

import { useEffect, useState } from "react";
import { Banknote, CheckCircle2 } from "lucide-react";
import { Badge, Button, Card, DataTable, ErrorBlock, Field, Input, LoadingBlock, Notice, PageHeader, Stat, Textarea, useToast } from "./ui";
import { ClientApiError, apiFetch, qs, useApi } from "@/lib/api-client";
import { addDays, dateOf, dateTime, istDate, rupees } from "@/lib/format";

interface Figures {
  cash_received: number;
  cash_refunds: number;
  upi_received: number;
  card_received: number;
  paid_orders: number;
  cash_expenses: number;
  unpaid_orders: number;
  unpaid_total: number;
  open_orders: number;
}
interface Closing {
  day: string;
  opening_float: number;
  cash_received: number;
  cash_paid_out: number;
  expected_cash: number;
  counted_cash: number;
  difference: number;
  note: string;
  closed_by_name: string | null;
  closed_at: string;
}
interface Data {
  day: string;
  figures: Figures;
  closing: Closing | null;
  last_float: number | null;
  history: { day: string; expected_cash: number; counted_cash: number; difference: number; cash_received: number; upi_received: number; card_received: number; closed_by_name: string | null }[];
}

const num = (s: string) => (s.trim() === "" ? NaN : Number(s));
const diffLabel = (d: number) => (d === 0 ? "Matched" : d < 0 ? `Short ${rupees(-d)}` : `Over ${rupees(d)}`);
const diffTone = (d: number) => (d === 0 ? "success" : Math.abs(d) <= 50 ? "warning" : "danger") as "success" | "warning" | "danger";

export function ClosingPage() {
  const toast = useToast();
  const [day, setDay] = useState(istDate());
  const { data, error, loading, reload } = useApi<Data>(`/api/admin/closing${qs({ day })}`);
  const [f, setF] = useState({ opening_float: "", paid_out: "", counted: "", note: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<ClientApiError | null>(null);

  // prefill from an existing closing, else carry over the last float and the day's cash expenses
  useEffect(() => {
    if (!data || data.day !== day) return;
    const c = data.closing;
    setF(
      c
        ? { opening_float: String(Number(c.opening_float)), paid_out: String(Number(c.cash_paid_out)), counted: String(Number(c.counted_cash)), note: c.note ?? "" }
        : { opening_float: data.last_float !== null ? String(data.last_float) : "", paid_out: data.figures.cash_expenses ? String(data.figures.cash_expenses) : "", counted: "", note: "" },
    );
    setErr(null);
  }, [data, day]);

  const fig = data?.figures;
  const float = num(f.opening_float) || 0;
  const paid = num(f.paid_out) || 0;
  const expected = fig ? Math.round((float + fig.cash_received - paid) * 100) / 100 : 0;
  const counted = num(f.counted);
  const difference = Number.isFinite(counted) ? Math.round((counted - expected) * 100) / 100 : null;

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      await apiFetch("/api/admin/closing", { method: "POST", body: { day, opening_float: float, paid_out: paid, counted, note: f.note } });
      toast(data?.closing ? "Day re-closed" : "Day closed");
      reload();
    } catch (e) {
      setErr(e as ClientApiError);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Close the day"
        description="Count the cash drawer at closing time. We work out what should be there from today's cash payments, so you can see straight away if it's short or over."
        actions={
          <Field label="Day" htmlFor="cl-day">
            <Input id="cl-day" type="date" value={day} max={istDate()} min={addDays(istDate(), -62)} onChange={(e) => e.target.value && setDay(e.target.value)} />
          </Field>
        }
      />
      <ErrorBlock error={error} retry={reload} />
      {loading && !data ? (
        <LoadingBlock />
      ) : fig ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Cash taken" value={rupees(fig.cash_received)} sub={fig.cash_refunds ? `after ${rupees(fig.cash_refunds)} refunds` : `${fig.paid_orders} paid orders`} />
            <Stat label="UPI" value={rupees(fig.upi_received)} />
            <Stat label="Card" value={rupees(fig.card_received)} />
            <Stat label="Still unpaid" value={rupees(fig.unpaid_total)} sub={`${fig.unpaid_orders} orders`} tone={fig.unpaid_orders ? "warning" : "default"} href="/admin/orders" />
          </div>
          {fig.open_orders > 0 && <Notice tone="warning">{fig.open_orders} orders from this day are still open. Settle them before closing so the cash figure is complete.</Notice>}

          <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
            <Card title={data!.closing ? "Re-count this day" : "Count the drawer"} description={data!.closing ? `Closed by ${data!.closing.closed_by_name ?? "—"} · ${dateTime(data!.closing.closed_at)}. Saving again replaces it and is recorded in the audit log.` : undefined}>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Opening float" htmlFor="cl-float" hint={data!.last_float !== null && !data!.closing ? "Carried from the last closing" : "Cash in the drawer at opening"}>
                  <Input id="cl-float" type="number" min={0} step="0.01" inputMode="decimal" prefix="₹" value={f.opening_float} onChange={(e) => setF({ ...f, opening_float: e.target.value })} />
                </Field>
                <Field label="Paid out from drawer" htmlFor="cl-paid" hint={fig.cash_expenses ? `${rupees(fig.cash_expenses)} of cash expenses logged` : "Cash taken out for purchases etc."}>
                  <Input id="cl-paid" type="number" min={0} step="0.01" inputMode="decimal" prefix="₹" value={f.paid_out} onChange={(e) => setF({ ...f, paid_out: e.target.value })} />
                </Field>
                <Field label="Cash counted" htmlFor="cl-count">
                  <Input id="cl-count" type="number" min={0} step="0.01" inputMode="decimal" prefix="₹" value={f.counted} onChange={(e) => setF({ ...f, counted: e.target.value })} />
                </Field>
              </div>
              <Field label="Note" optional htmlFor="cl-note" className="mt-3">
                <Textarea id="cl-note" rows={2} maxLength={200} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="e.g. ₹200 change given from personal cash" />
              </Field>
              {err && <Notice tone="danger" className="mt-3">{err.message}</Notice>}
              <div className="mt-4 flex justify-end">
                <Button loading={busy} disabled={!Number.isFinite(counted)} icon={<CheckCircle2 size={16} />} onClick={save}>
                  {data!.closing ? "Save re-count" : "Close the day"}
                </Button>
              </div>
            </Card>
            <Card title="Drawer check">
              <dl className="space-y-2 text-[14px]">
                <div className="flex justify-between"><dt className="text-muted">Opening float</dt><dd className="num">{rupees(float)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted">+ Cash taken</dt><dd className="num">{rupees(fig.cash_received)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted">− Paid out</dt><dd className="num">{rupees(paid)}</dd></div>
                <div className="flex justify-between border-t border-line pt-2 font-semibold"><dt>Should be in drawer</dt><dd className="num">{rupees(expected)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted">Counted</dt><dd className="num">{Number.isFinite(counted) ? rupees(counted) : "—"}</dd></div>
              </dl>
              <div className="mt-4 flex items-center gap-3 rounded-lg bg-surface-2 p-3">
                <Banknote size={20} className="text-muted" aria-hidden />
                {difference === null ? <span className="text-[14px] text-muted">Enter the counted cash</span> : <Badge tone={diffTone(difference)} className="text-[14px]">{diffLabel(difference)}</Badge>}
              </div>
            </Card>
          </div>

          <Card title="Recent closings" padded={false}>
            <DataTable
              rows={data!.history}
              rowKey={(r) => r.day}
              onRowClick={(r) => setDay(r.day)}
              empty={<p className="p-4 text-[14px] text-muted">No days closed yet.</p>}
              columns={[
                { key: "day", header: "Day", primary: true, cell: (r) => <span className="font-semibold">{dateOf(r.day + "T12:00:00+05:30")}</span> },
                { key: "cash", header: "Cash", align: "right", cell: (r) => <span className="num">{rupees(Number(r.cash_received))}</span> },
                { key: "upi", header: "UPI", align: "right", cell: (r) => <span className="num">{rupees(Number(r.upi_received))}</span> },
                { key: "exp", header: "Expected", align: "right", cell: (r) => <span className="num">{rupees(Number(r.expected_cash))}</span> },
                { key: "cnt", header: "Counted", align: "right", cell: (r) => <span className="num">{rupees(Number(r.counted_cash))}</span> },
                { key: "diff", header: "Result", cell: (r) => <Badge tone={diffTone(Number(r.difference))}>{diffLabel(Number(r.difference))}</Badge> },
                { key: "by", header: "Closed by", hideOnCard: true, cell: (r) => r.closed_by_name ?? "—" },
              ]}
            />
          </Card>
        </div>
      ) : null}
    </>
  );
}
