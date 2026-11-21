"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, CircleSlash, Mail, MessageCircle, MessageSquare, Pencil, Play, Plus, Send, TerminalSquare } from "lucide-react";
import { Badge, Button, Card, Checkbox, DataTable, Dialog, Empty, ErrorBlock, Field, Input, LoadingBlock, Notice, PageHeader, Select, Tabs, Textarea, useConfirm, useToast } from "../ui";
import { apiFetch, qs, useApi, type ClientApiError } from "@/lib/api-client";
import { ago, dateTime } from "@/lib/format";
import { clsx } from "@/lib/clsx";

type Channel = "email" | "sms" | "whatsapp";
interface ChannelState {
  mode: "live" | "off" | "dev-log";
  provider: string | null;
}
interface Overview {
  channels: { sms: ChannelState; whatsapp: ChannelState; email: ChannelState; cron: boolean };
  settings: { birthday_enabled: boolean; birthday_template_ids: string[]; send_hour: number };
  jobs: { name: string; last_started_at: string | null; last_finished_at: string | null; last_result: Record<string, unknown>; last_error: string | null }[];
  last30: { sent: number; delivered: number; failed: number; queued: number; test_mode: number };
  templates: { id: string; name: string; channel: Channel; kind: string; is_active: boolean }[];
}

const CH_LABEL: Record<Channel, string> = { sms: "SMS", whatsapp: "WhatsApp", email: "Email" };
const CH_ICON = { sms: MessageSquare, whatsapp: MessageCircle, email: Mail };

export function NotificationsPage() {
  const [tab, setTab] = useState<"overview" | "campaigns" | "templates" | "log">("overview");
  const ov = useApi<Overview>("/api/admin/notifications");
  return (
    <>
      <PageHeader title="Notifications & campaigns" description="Birthday greetings and offers by SMS, WhatsApp or email — only to customers who opted in." />
      <Tabs
        className="mb-4"
        value={tab}
        onChange={setTab}
        items={[
          { value: "overview", label: "Overview" },
          { value: "campaigns", label: "Campaigns" },
          { value: "templates", label: "Messages" },
          { value: "log", label: "Delivery log" },
        ]}
      />
      {ov.error && <ErrorBlock error={ov.error} retry={ov.reload} />}
      {tab === "overview" && (ov.loading || !ov.data ? <LoadingBlock rows={6} /> : <OverviewTab data={ov.data} reload={ov.reload} />)}
      {tab === "campaigns" && ov.data && <CampaignsTab channels={ov.data.channels} />}
      {tab === "templates" && ov.data && <TemplatesTab channels={ov.data.channels} onChanged={ov.reload} />}
      {tab === "log" && <LogTab />}
    </>
  );
}

function ChannelBadge({ s }: { s: ChannelState }) {
  if (s.mode === "live") return <Badge tone="success">Live · {s.provider}</Badge>;
  if (s.mode === "dev-log") return <Badge tone="warning">Not set up · test mode</Badge>;
  return <Badge tone="danger">Not set up</Badge>;
}

/* ── Overview ───────────────────────────────────────────────────────────── */

function OverviewTab({ data, reload }: { data: Overview; reload: () => void }) {
  const toast = useToast();
  const [running, setRunning] = useState(false);
  const anyOff = (["sms", "whatsapp", "email"] as Channel[]).some((c) => data.channels[c].mode !== "live");
  const run = async () => {
    setRunning(true);
    try {
      const r = await apiFetch<{ queue: { sent: number; failed: number; logged: number } }>("/api/admin/notifications/run", { method: "POST" });
      toast(`Jobs ran · ${r.queue.sent} sent, ${r.queue.failed} failed${r.queue.logged ? `, ${r.queue.logged} not sent (test mode)` : ""}`);
      reload();
    } catch (e) {
      toast((e as ClientApiError).message, "error");
    } finally {
      setRunning(false);
    }
  };
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Delivery channels" description="Messages only go out through a configured provider. Nothing is marked sent unless the provider accepted it.">
        <ul className="divide-y divide-line">
          {(["sms", "whatsapp", "email"] as Channel[]).map((c) => {
            const Icon = CH_ICON[c];
            return (
              <li key={c} className="flex items-center justify-between gap-3 py-2.5">
                <span className="flex items-center gap-2 font-semibold">
                  <Icon size={16} className="text-muted" aria-hidden />
                  {CH_LABEL[c]}
                </span>
                <ChannelBadge s={data.channels[c]} />
              </li>
            );
          })}
          <li className="flex items-center justify-between gap-3 py-2.5">
            <span className="flex items-center gap-2 font-semibold">
              <TerminalSquare size={16} className="text-muted" aria-hidden />
              Scheduler
            </span>
            {data.channels.cron ? <Badge tone="success">Configured</Badge> : <Badge tone="warning">Not set up</Badge>}
          </li>
        </ul>
        {anyOff && (
          <Notice tone="primary" className="mt-3">
            To switch a channel on, the site owner adds the provider keys to the server environment: <code>TWILIO_ACCOUNT_SID</code>, <code>TWILIO_AUTH_TOKEN</code> and <code>TWILIO_SMS_FROM</code> / <code>TWILIO_WHATSAPP_FROM</code> for SMS and WhatsApp; <code>RESEND_API_KEY</code> and <code>EMAIL_FROM</code> for email. {data.channels.sms.mode === "dev-log" && "In test mode, messages are written to the server log instead of being sent."}
          </Notice>
        )}
        {!data.channels.cron && <p className="mt-3 text-[13px] text-muted">Without the scheduler (<code>CRON_SECRET</code>), scheduled campaigns, birthday messages and points expiry only run when you press “Run jobs now”.</p>}
      </Card>
      <div className="space-y-4">
        <BirthdayCard data={data} reload={reload} />
        <Card
          title="Last 30 days"
          actions={
            <Button size="sm" variant="secondary" icon={<Play size={14} />} loading={running} onClick={run}>
              Run jobs now
            </Button>
          }
        >
          <dl className="grid grid-cols-4 gap-2 text-center">
            {[
              ["Sent", data.last30.sent],
              ["Delivered", data.last30.delivered],
              ["Failed", data.last30.failed],
              ["Waiting", data.last30.queued],
            ].map(([k, v]) => (
              <div key={k as string} className="rounded-lg bg-surface-2 px-2 py-2">
                <dt className="text-[12px] text-muted">{k}</dt>
                <dd className={clsx("num text-[18px] font-bold", k === "Failed" && Number(v) > 0 && "text-danger")}>{v}</dd>
              </div>
            ))}
          </dl>
          {data.last30.test_mode > 0 && <p className="mt-2 text-[12.5px] text-warning">{data.last30.test_mode} message(s) were not sent because their channel isn&apos;t set up (test mode).</p>}
          {data.jobs.length > 0 && (
            <ul className="mt-3 space-y-1 text-[12.5px] text-muted">
              {data.jobs.map((j) => (
                <li key={j.name} className="flex justify-between gap-2">
                  <span className="capitalize">{j.name.replace("-", " ")}</span>
                  <span className={clsx(j.last_error && "text-danger")}>{j.last_error ? `Failed: ${j.last_error}` : j.last_finished_at ? `ran ${ago(j.last_finished_at)}` : "never"}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function BirthdayCard({ data, reload }: { data: Overview; reload: () => void }) {
  const toast = useToast();
  const [s, setS] = useState(data.settings);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<ClientApiError | null>(null);
  const birthdayTpls = data.templates.filter((t) => t.is_active && (t.kind === "birthday" || s.birthday_template_ids.includes(t.id)));
  const toggle = (id: string, on: boolean) => setS((x) => ({ ...x, birthday_template_ids: on ? [...x.birthday_template_ids, id] : x.birthday_template_ids.filter((i) => i !== id) }));
  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      await apiFetch("/api/admin/notifications", { method: "PUT", body: s });
      toast("Birthday messages saved");
      reload();
    } catch (e) {
      setErr(e as ClientApiError);
    } finally {
      setBusy(false);
    }
  };
  const dirty = JSON.stringify(s) !== JSON.stringify(data.settings);
  return (
    <Card title="Birthday greetings" description="Sent once a year on the customer's birthday, to those who opted in.">
      {err && <Notice tone="danger" className="mb-3">{err.message}</Notice>}
      <Checkbox label="Send birthday greetings" checked={s.birthday_enabled} onChange={(v) => setS({ ...s, birthday_enabled: v })} />
      {s.birthday_enabled && (
        <div className="mt-3 space-y-3 pl-7">
          {!birthdayTpls.length ? (
            <p className="text-[13.5px] text-muted">Create a message of type “Birthday” in Messages first.</p>
          ) : (
            birthdayTpls.map((t) => (
              <Checkbox
                key={t.id}
                label={`${t.name} (${CH_LABEL[t.channel]})`}
                hint={data.channels[t.channel].mode !== "live" ? `${CH_LABEL[t.channel]} isn't set up — this one won't be delivered.` : undefined}
                checked={s.birthday_template_ids.includes(t.id)}
                onChange={(v) => toggle(t.id, v)}
              />
            ))
          )}
          <Field label="Send at" htmlFor="bd-hour">
            <Select id="bd-hour" className="w-40" value={s.send_hour} onChange={(e) => setS({ ...s, send_hour: Number(e.target.value) })}>
              {Array.from({ length: 16 }, (_, i) => i + 6).map((h) => (
                <option key={h} value={h}>
                  {h % 12 || 12}:00 {h < 12 ? "am" : "pm"}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      )}
      <div className="mt-4 flex justify-end">
        <Button onClick={save} loading={busy} disabled={!dirty}>
          Save
        </Button>
      </div>
    </Card>
  );
}

/* ── Messages (templates) ───────────────────────────────────────────────── */

interface Template {
  id: string;
  name: string;
  channel: Channel;
  kind: "birthday" | "promotion" | "transactional" | "custom";
  subject: string;
  body: string;
  is_active: boolean;
  campaigns: number;
}

function TemplatesTab({ channels, onChanged }: { channels: Overview["channels"]; onChanged: () => void }) {
  const { data, error, loading, reload } = useApi<{ templates: Template[] }>("/api/admin/notifications/templates");
  const [edit, setEdit] = useState<Template | "new" | null>(null);
  return (
    <Card
      padded={false}
      title="Messages"
      description="Reusable message texts for campaigns and birthdays."
      actions={
        <Button size="sm" icon={<Plus size={14} />} onClick={() => setEdit("new")}>
          New message
        </Button>
      }
    >
      <ErrorBlock error={error} retry={reload} />
      {loading ? (
        <div className="p-4">
          <LoadingBlock rows={4} />
        </div>
      ) : (
        <DataTable
          rows={data?.templates ?? []}
          rowKey={(t) => t.id}
          onRowClick={(t) => setEdit(t)}
          empty={<Empty title="No messages yet" />}
          columns={[
            { key: "n", header: "Message", primary: true, cell: (t) => <span className="font-semibold">{t.name} {!t.is_active && <Badge>Off</Badge>}</span> },
            { key: "c", header: "Channel", cell: (t) => CH_LABEL[t.channel] },
            { key: "k", header: "Type", cell: (t) => <span className="capitalize">{t.kind}</span> },
            { key: "b", header: "Text", hideOnCard: true, cell: (t) => <span className="line-clamp-1 max-w-[380px] text-muted">{t.body}</span> },
            { key: "e", header: <span className="sr-only">Edit</span>, align: "right", hideOnCard: true, cell: () => <Pencil size={14} className="ml-auto text-muted" aria-hidden /> },
          ]}
        />
      )}
      {edit && (
        <TemplateEditor
          template={edit === "new" ? null : edit}
          channels={channels}
          onClose={() => setEdit(null)}
          onSaved={() => {
            reload();
            onChanged();
          }}
        />
      )}
    </Card>
  );
}

const PLACEHOLDERS = ["first_name", "name", "points", "business", "unsubscribe_url"];

function TemplateEditor({ template, channels, onClose, onSaved }: { template: Template | null; channels: Overview["channels"]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ name: template?.name ?? "", channel: template?.channel ?? ("sms" as Channel), kind: template?.kind ?? ("promotion" as Template["kind"]), subject: template?.subject ?? "", body: template?.body ?? "", is_active: template?.is_active ?? true });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<ClientApiError | null>(null);
  const [testTo, setTestTo] = useState("");
  const [testing, setTesting] = useState(false);
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const preview = f.body.replace(/\{\{\s*first_name\s*\}\}/g, "Asha").replace(/\{\{\s*name\s*\}\}/g, "Asha Rao").replace(/\{\{\s*points\s*\}\}/g, "240").replace(/\{\{\s*business\s*\}\}/g, "NEELARYAN Café").replace(/\{\{\s*unsubscribe_url\s*\}\}/g, "https://…/unsubscribe");
  const segments = f.channel === "sms" ? Math.max(1, Math.ceil((preview.length + (f.kind === "transactional" ? 0 : 40)) / 160)) : null;

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      if (template) await apiFetch(`/api/admin/notifications/templates/${template.id}`, { method: "PATCH", body: f });
      else await apiFetch("/api/admin/notifications/templates", { body: f });
      toast("Message saved");
      onSaved();
      onClose();
    } catch (e) {
      setErr(e as ClientApiError);
    } finally {
      setBusy(false);
    }
  };
  const test = async () => {
    if (!template) return;
    setTesting(true);
    try {
      const r = await apiFetch<{ provider: string; delivered_to_log_only: boolean }>(`/api/admin/notifications/templates/${template.id}/test`, { body: { to: testTo } });
      toast(r.delivered_to_log_only ? "Test written to the server log — this channel isn't set up, so nothing was really sent" : `Test sent via ${r.provider}`, r.delivered_to_log_only ? "error" : "success");
    } catch (e) {
      toast((e as ClientApiError).message, "error");
    } finally {
      setTesting(false);
    }
  };
  const fe = err?.fields ?? {};
  return (
    <Dialog
      open
      side
      size="lg"
      onClose={onClose}
      title={template ? `Edit “${template.name}”` : "New message"}
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
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Name" htmlFor="tp-name" error={fe.name} className="sm:col-span-3">
          <Input id="tp-name" value={f.name} maxLength={60} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field label="Channel" htmlFor="tp-ch">
          <Select id="tp-ch" value={f.channel} onChange={(e) => set({ channel: e.target.value as Channel })}>
            <option value="sms">SMS</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="email">Email</option>
          </Select>
        </Field>
        <Field label="Type" htmlFor="tp-kind">
          <Select id="tp-kind" value={f.kind} onChange={(e) => set({ kind: e.target.value as Template["kind"] })}>
            <option value="promotion">Promotion</option>
            <option value="birthday">Birthday</option>
            <option value="custom">Other</option>
            <option value="transactional">Service (no unsubscribe link)</option>
          </Select>
        </Field>
        <div className="flex items-end pb-2">
          <ChannelBadge s={channels[f.channel]} />
        </div>
        {f.channel === "email" && (
          <Field label="Subject" htmlFor="tp-sub" error={fe.subject} className="sm:col-span-3">
            <Input id="tp-sub" value={f.subject} maxLength={120} onChange={(e) => set({ subject: e.target.value })} />
          </Field>
        )}
        <Field label="Text" htmlFor="tp-body" error={fe.body} className="sm:col-span-3" hint={<>Placeholders: {PLACEHOLDERS.map((p) => <code key={p} className="mr-1">{`{{${p}}}`}</code>)}</>}>
          <Textarea id="tp-body" rows={6} maxLength={2000} value={f.body} onChange={(e) => set({ body: e.target.value })} />
        </Field>
      </div>
      {f.channel === "whatsapp" && (
        <Notice tone="warning" className="mt-3">
          WhatsApp only allows business-initiated messages that use a template approved by Meta. Register this exact text as a template in your Twilio WhatsApp sender before sending.
        </Notice>
      )}
      <div className="mt-4 rounded-xl border border-line bg-surface-2/60 p-3">
        <p className="eyebrow mb-2">Preview</p>
        <p className="whitespace-pre-line text-[14px]">{preview || <span className="text-muted">Start typing…</span>}</p>
        {f.kind !== "transactional" && <p className="mt-2 text-[12.5px] text-muted">An unsubscribe link is added automatically if the text doesn&apos;t include one.</p>}
        {segments && <p className="mt-1 text-[12.5px] text-muted">About {segments} SMS segment{segments === 1 ? "" : "s"} per customer.</p>}
      </div>
      <div className="mt-3">
        <Checkbox label="Active" checked={f.is_active} onChange={(v) => set({ is_active: v })} />
      </div>
      {template && (
        <div className="mt-4 rounded-xl border border-line p-3">
          <p className="mb-2 text-[13.5px] font-semibold">Send a test (uses the saved version)</p>
          <div className="flex gap-2">
            <Input aria-label="Send test to" placeholder={template.channel === "email" ? "you@example.com" : "Mobile number"} value={testTo} onChange={(e) => setTestTo(e.target.value)} />
            <Button variant="secondary" icon={<Send size={14} />} loading={testing} disabled={testTo.trim().length < 5} onClick={test}>
              Send test
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

/* ── Campaigns ──────────────────────────────────────────────────────────── */

interface Campaign {
  id: string;
  name: string;
  status: "draft" | "scheduled" | "sending" | "sent" | "failed" | "cancelled";
  audience: Audience;
  audience_label: string;
  scheduled_at: string | null;
  sent_at: string | null;
  created_at: string;
  stats: { audience?: number; queued?: number; sent?: number; failed?: number; delivered?: number; error?: string };
  notes: string;
  template_id: string;
  template: string;
  channel: Channel;
  created_by: string | null;
}
type Audience = { segment: "all" } | { segment: "birthday_month" } | { segment: "inactive"; days: number } | { segment: "recent"; days: number } | { segment: "points"; min_points: number };

const STATUS_TONE = { draft: "neutral", scheduled: "primary", sending: "warning", sent: "success", failed: "danger", cancelled: "neutral" } as const;

function CampaignsTab({ channels }: { channels: Overview["channels"] }) {
  const { data, error, loading, reload } = useApi<{ campaigns: Campaign[] }>("/api/admin/notifications/campaigns");
  const [edit, setEdit] = useState<Campaign | "new" | null>(null);
  return (
    <Card
      padded={false}
      title="Campaigns"
      actions={
        <Button size="sm" icon={<Plus size={14} />} onClick={() => setEdit("new")}>
          New campaign
        </Button>
      }
    >
      <ErrorBlock error={error} retry={reload} />
      {loading ? (
        <div className="p-4">
          <LoadingBlock rows={4} />
        </div>
      ) : (
        <DataTable
          rows={data?.campaigns ?? []}
          rowKey={(c) => c.id}
          onRowClick={(c) => setEdit(c)}
          empty={<Empty title="No campaigns yet">Send an offer to customers who opted in — for example, a weekday deal to those who haven&apos;t visited in a month.</Empty>}
          columns={[
            { key: "n", header: "Campaign", primary: true, cell: (c) => <span className="font-semibold">{c.name}</span> },
            { key: "a", header: "Audience", cell: (c) => c.audience_label },
            { key: "m", header: "Message", hideOnCard: true, cell: (c) => `${c.template} · ${CH_LABEL[c.channel]}` },
            {
              key: "s",
              header: "Status",
              cell: (c) => (
                <Badge tone={STATUS_TONE[c.status]}>
                  {c.status === "scheduled" && c.scheduled_at ? `Scheduled ${dateTime(c.scheduled_at)}` : c.status[0].toUpperCase() + c.status.slice(1)}
                </Badge>
              ),
            },
            { key: "r", header: "Result", align: "right", cell: (c) => (c.stats.sent !== undefined || c.stats.queued !== undefined ? <span className="num">{c.stats.sent ?? 0} sent{c.stats.failed ? ` · ${c.stats.failed} failed` : ""}</span> : <span className="text-muted">—</span>) },
          ]}
        />
      )}
      {edit && <CampaignEditor campaign={edit === "new" ? null : edit} channels={channels} onClose={() => setEdit(null)} onSaved={reload} />}
    </Card>
  );
}

function CampaignEditor({ campaign, channels, onClose, onSaved }: { campaign: Campaign | null; channels: Overview["channels"]; onClose: () => void; onSaved: () => void }) {
  const { data: tdata } = useApi<{ templates: Template[] }>("/api/admin/notifications/templates");
  const toast = useToast();
  const { ask, node } = useConfirm();
  const readOnly = !!campaign && campaign.status !== "draft";
  const [f, setF] = useState({ name: campaign?.name ?? "", template_id: campaign?.template_id ?? "", notes: campaign?.notes ?? "" });
  const [aud, setAud] = useState<Audience>(campaign?.audience ?? { segment: "all" });
  const [count, setCount] = useState<{ n: number; total: number } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<ClientApiError | null>(null);
  const [when, setWhen] = useState("");
  const templates = (tdata?.templates ?? []).filter((t) => t.is_active && t.kind !== "transactional");
  const tpl = templates.find((t) => t.id === f.template_id) ?? (tdata?.templates ?? []).find((t) => t.id === f.template_id);
  const ch = tpl?.channel;

  useEffect(() => {
    if (!ch) return setCount(null);
    const t = setTimeout(() => {
      apiFetch<{ n: number; total: number }>("/api/admin/notifications/audience", { body: { audience: aud, channel: ch } })
        .then(setCount)
        .catch(() => setCount(null));
    }, 250);
    return () => clearTimeout(t);
  }, [aud, ch]);

  const persist = async () => {
    const body = { ...f, audience: aud };
    if (campaign) {
      await apiFetch(`/api/admin/notifications/campaigns/${campaign.id}`, { method: "PATCH", body });
      return campaign.id;
    }
    return (await apiFetch<{ id: string }>("/api/admin/notifications/campaigns", { body })).id;
  };
  const act = async (what: "save" | "send" | "schedule" | "cancel") => {
    setErr(null);
    if (what === "send") {
      const r = await ask({ title: `Send “${f.name}” now?`, body: `It goes to ${count?.n ?? 0} customer(s) by ${ch ? CH_LABEL[ch] : ""}. This can't be undone.`, confirm: "Send now" });
      if (!r.ok) return;
    }
    if (what === "cancel") {
      const r = await ask({ title: "Cancel this campaign?", confirm: "Cancel campaign", danger: true });
      if (!r.ok) return;
    }
    setBusy(what);
    try {
      if (what === "cancel") {
        await apiFetch(`/api/admin/notifications/campaigns/${campaign!.id}`, { body: { action: "cancel" } });
        toast("Campaign cancelled");
      } else {
        const id = await persist();
        if (what === "send") {
          const r = await apiFetch<{ queued: number; sent: number; failed: number; logged: number }>(`/api/admin/notifications/campaigns/${id}`, { body: { action: "send" } });
          const rest = r.queued - r.sent - r.failed - r.logged;
          toast(
            r.logged && !r.sent
              ? `Not delivered: ${r.logged} message(s) written to the server log because the channel isn't set up`
              : `${r.sent} sent${r.failed ? `, ${r.failed} failed` : ""}${rest > 0 ? ` · ${rest} more will follow` : ""}`,
            (r.failed || r.logged) && !r.sent ? "error" : "success",
          );
        } else if (what === "schedule") {
          await apiFetch(`/api/admin/notifications/campaigns/${id}`, { body: { action: "schedule", at: new Date(when).toISOString() } });
          toast("Campaign scheduled");
        } else toast("Draft saved");
      }
      onSaved();
      onClose();
    } catch (e) {
      setErr(e as ClientApiError);
    } finally {
      setBusy(null);
    }
  };
  const fe = err?.fields ?? {};
  const ready = f.name.trim().length >= 2 && !!f.template_id;
  const chState = ch ? channels[ch] : null;

  return (
    <Dialog
      open
      side
      size="lg"
      onClose={onClose}
      title={campaign ? campaign.name : "New campaign"}
      description={campaign ? `Created ${dateTime(campaign.created_at)}${campaign.created_by ? ` by ${campaign.created_by}` : ""}` : undefined}
      footer={
        readOnly ? (
          campaign!.status === "scheduled" ? (
            <Button variant="danger" loading={busy === "cancel"} onClick={() => act("cancel")}>
              Cancel campaign
            </Button>
          ) : (
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          )
        ) : (
          <>
            <Button variant="ghost" className="mr-auto" loading={busy === "save"} disabled={!ready} onClick={() => act("save")}>
              Save draft
            </Button>
            <Button variant="secondary" loading={busy === "schedule"} disabled={!ready || !when || !count?.n} onClick={() => act("schedule")}>
              Schedule
            </Button>
            <Button icon={<Send size={14} />} loading={busy === "send"} disabled={!ready || !count?.n || chState?.mode === "off"} onClick={() => act("send")}>
              Send now
            </Button>
          </>
        )
      }
    >
      {node}
      {err && <Notice tone="danger" className="mb-3">{err.message}</Notice>}
      {readOnly && campaign && (
        <Notice tone={campaign.status === "failed" ? "danger" : "primary"} className="mb-3">
          {campaign.status === "sent" && `Sent ${campaign.sent_at ? dateTime(campaign.sent_at) : ""} · ${campaign.stats.sent ?? 0} sent, ${campaign.stats.delivered ?? 0} confirmed delivered, ${campaign.stats.failed ?? 0} failed.`}
          {campaign.status === "sending" && `Sending · ${campaign.stats.queued ?? 0} queued.`}
          {campaign.status === "scheduled" && `Scheduled for ${dateTime(campaign.scheduled_at!)}.`}
          {campaign.status === "failed" && `Failed${campaign.stats.error ? `: ${campaign.stats.error}` : ""}.`}
          {campaign.status === "cancelled" && "Cancelled."}
        </Notice>
      )}
      <fieldset disabled={readOnly} className="space-y-3">
        <Field label="Campaign name" htmlFor="cp-name" error={fe.name} hint="Only staff see this">
          <Input id="cp-name" value={f.name} maxLength={80} placeholder="Monsoon weekday offer" onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="Message" htmlFor="cp-tpl" error={fe.template_id}>
          <Select id="cp-tpl" value={f.template_id} onChange={(e) => setF({ ...f, template_id: e.target.value })}>
            <option value="">Choose a message…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} · {CH_LABEL[t.channel]}
              </option>
            ))}
          </Select>
        </Field>
        {tpl && <p className="whitespace-pre-line rounded-lg bg-surface-2 px-3 py-2 text-[13.5px]">{tpl.body}</p>}
        {chState && chState.mode !== "live" && (
          <Notice tone={chState.mode === "off" ? "danger" : "warning"}>
            {CH_LABEL[ch!]} isn&apos;t set up. {chState.mode === "off" ? "This campaign can't be sent until it is." : "In test mode, messages are written to the server log — customers won't receive them."}
          </Notice>
        )}
        <AudiencePicker value={aud} onChange={setAud} />
        <p className="rounded-lg border border-line px-3 py-2 text-[14px]">
          {count === null ? (
            <span className="text-muted">Choose a message to see who it reaches.</span>
          ) : (
            <>
              Reaches <b className="num">{count.n}</b> customer{count.n === 1 ? "" : "s"}
              <span className="text-muted"> — opted in, with {ch === "email" ? "an email address" : "a mobile number"} ({count.total} customers in total)</span>
            </>
          )}
        </p>
        {!readOnly && (
          <Field label="Or schedule for" htmlFor="cp-when" optional>
            <Input id="cp-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          </Field>
        )}
        <Field label="Notes" htmlFor="cp-notes" optional>
          <Textarea id="cp-notes" rows={2} maxLength={300} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>
      </fieldset>
    </Dialog>
  );
}

function AudiencePicker({ value, onChange }: { value: Audience; onChange: (a: Audience) => void }) {
  const seg = value.segment;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Send to" htmlFor="cp-seg">
        <Select
          id="cp-seg"
          value={seg}
          onChange={(e) => {
            const s = e.target.value as Audience["segment"];
            onChange(s === "inactive" ? { segment: s, days: 30 } : s === "recent" ? { segment: s, days: 30 } : s === "points" ? { segment: s, min_points: 100 } : ({ segment: s } as Audience));
          }}
        >
          <option value="all">Everyone who opted in</option>
          <option value="inactive">Haven&apos;t visited for a while</option>
          <option value="recent">Visited recently</option>
          <option value="points">Have enough points for a reward</option>
          <option value="birthday_month">Birthday this month</option>
        </Select>
      </Field>
      {(value.segment === "inactive" || value.segment === "recent") && (
        <Field label={value.segment === "inactive" ? "No visit in the last" : "Visited in the last"} htmlFor="cp-days">
          <Input id="cp-days" inputMode="numeric" suffix="days" value={String(value.days)} onChange={(e) => onChange({ ...value, days: Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 1) })} />
        </Field>
      )}
      {value.segment === "points" && (
        <Field label="At least" htmlFor="cp-pts">
          <Input id="cp-pts" inputMode="numeric" suffix="points" value={String(value.min_points)} onChange={(e) => onChange({ ...value, min_points: Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 1) })} />
        </Field>
      )}
    </div>
  );
}

/* ── Delivery log ───────────────────────────────────────────────────────── */

function LogTab() {
  const [status, setStatus] = useState("");
  const { data, error, loading, reload } = useApi<{ messages: { id: number; kind: string; channel: Channel; destination: string; subject: string; status: string; provider: string; error: string | null; created_at: string; customer: string | null; campaign: string | null }[] }>(
    `/api/admin/notifications/log${qs({ status: status || undefined })}`,
    { refreshMs: 15000 },
  );
  return (
    <Card padded={false}>
      <div className="flex items-center gap-2 border-b border-line p-3">
        <Select aria-label="Status" className="w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All messages</option>
          <option value="queued">Waiting</option>
          <option value="sent">Sent</option>
          <option value="delivered">Delivered</option>
          <option value="failed">Failed</option>
          <option value="skipped">Not sent</option>
        </Select>
      </div>
      <ErrorBlock error={error} retry={reload} />
      {loading ? (
        <div className="p-4">
          <LoadingBlock rows={5} />
        </div>
      ) : (
        <DataTable
          dense
          rows={data?.messages ?? []}
          rowKey={(m) => String(m.id)}
          empty={<Empty title="No messages yet" />}
          columns={[
            { key: "w", header: "When", cell: (m) => dateTime(m.created_at) },
            { key: "c", header: "Customer", primary: true, cell: (m) => <span className="font-semibold">{m.customer ?? "—"}</span> },
            { key: "ch", header: "Channel", cell: (m) => `${CH_LABEL[m.channel]} · ${m.destination}` },
            { key: "f", header: "From", hideOnCard: true, cell: (m) => m.campaign ?? <span className="capitalize">{m.kind}</span> },
            {
              key: "s",
              header: "Status",
              cell: (m) => (
                <span className="inline-flex items-center gap-1.5">
                  {m.status === "delivered" ? <CheckCircle2 size={14} className="text-success" aria-hidden /> : m.status === "failed" ? <CircleSlash size={14} className="text-danger" aria-hidden /> : null}
                  <span className="capitalize">{m.provider === "dev-log" ? "Not sent (test mode)" : m.status}</span>
                </span>
              ),
            },
            { key: "e", header: "Detail", hideOnCard: true, cell: (m) => <span className="text-[12.5px] text-danger">{m.error ?? ""}</span> },
          ]}
        />
      )}
    </Card>
  );
}
