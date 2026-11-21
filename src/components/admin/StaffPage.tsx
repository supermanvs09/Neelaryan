"use client";

import { useState } from "react";
import { Copy, KeyRound, Lock, Plus, ShieldCheck } from "lucide-react";
import { Badge, Button, Card, Checkbox, DataTable, Dialog, ErrorBlock, Field, Input, LoadingBlock, Notice, PageHeader, Select, Tabs, Textarea, useConfirm, useToast } from "./ui";
import { useAdminUser } from "./AdminShell";
import { apiFetch, useApi, type ClientApiError } from "@/lib/api-client";
import { ago } from "@/lib/format";

interface StaffRow {
  id: string;
  username: string;
  name: string;
  email: string | null;
  phone: string | null;
  role_key: string;
  role_name: string;
  is_active: boolean;
  must_change_password: boolean;
  last_login_at: string | null;
  locked: boolean;
  sessions: number;
}

export function StaffPage() {
  const [tab, setTab] = useState<"staff" | "roles">("staff");
  return (
    <>
      <PageHeader title="Staff & permissions" description="Who can sign in, and what each role is allowed to do. Permissions are checked by the server on every action." />
      <Tabs className="mb-4" value={tab} onChange={setTab} items={[{ value: "staff", label: "Staff" }, { value: "roles", label: "Roles & permissions" }]} />
      {tab === "staff" ? <StaffTab /> : <RolesTab />}
    </>
  );
}

function TempPassword({ username, password, onClose }: { username: string; password: string; onClose: () => void }) {
  const toast = useToast();
  return (
    <Dialog open size="sm" onClose={onClose} title="Share this one-time password" footer={<Button onClick={onClose}>Done</Button>}>
      <p className="text-[14px]">
        Give it to <b>{username}</b> in person. They&apos;ll be asked to choose their own password when they sign in. It won&apos;t be shown again.
      </p>
      <div className="mt-4 flex items-center justify-between gap-2 rounded-lg border border-line bg-surface-2 px-4 py-3">
        <code className="num select-all text-[18px] font-bold">{password}</code>
        <Button
          size="sm"
          variant="secondary"
          icon={<Copy size={14} />}
          onClick={() => {
            navigator.clipboard?.writeText(password).then(() => toast("Copied"), () => undefined);
          }}
        >
          Copy
        </Button>
      </div>
    </Dialog>
  );
}

function StaffTab() {
  const { data, error, loading, reload } = useApi<{ staff: StaffRow[]; roles: { key: string; name: string }[] }>("/api/admin/staff");
  const me = useAdminUser();
  const [edit, setEdit] = useState<StaffRow | "new" | null>(null);
  const [temp, setTemp] = useState<{ username: string; password: string } | null>(null);
  return (
    <Card
      padded={false}
      title="Staff accounts"
      actions={
        <Button size="sm" icon={<Plus size={14} />} onClick={() => setEdit("new")}>
          Add staff
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
          rows={data?.staff ?? []}
          rowKey={(s) => s.id}
          onRowClick={(s) => setEdit(s)}
          columns={[
            {
              key: "n",
              header: "Name",
              primary: true,
              cell: (s) => (
                <span>
                  <span className="font-semibold">{s.name}</span> {s.id === me.id && <Badge tone="primary">You</Badge>}
                  <span className="block text-[12.5px] text-muted">@{s.username}</span>
                </span>
              ),
            },
            { key: "r", header: "Role", cell: (s) => s.role_name },
            {
              key: "s",
              header: "Status",
              cell: (s) =>
                !s.is_active ? <Badge>Deactivated</Badge> : s.locked ? <Badge tone="danger">Locked</Badge> : s.must_change_password ? <Badge tone="warning">Must set password</Badge> : <Badge tone="success">Active</Badge>,
            },
            { key: "l", header: "Last sign-in", cell: (s) => (s.last_login_at ? ago(s.last_login_at) : <span className="text-muted">Never</span>) },
          ]}
        />
      )}
      {edit && data && (
        <StaffEditor
          s={edit === "new" ? null : edit}
          roles={data.roles}
          isMe={edit !== "new" && edit.id === me.id}
          onClose={() => setEdit(null)}
          onSaved={reload}
          onTemp={(t) => setTemp(t)}
        />
      )}
      {temp && <TempPassword {...temp} onClose={() => setTemp(null)} />}
    </Card>
  );
}

function StaffEditor({ s, roles, isMe, onClose, onSaved, onTemp }: { s: StaffRow | null; roles: { key: string; name: string }[]; isMe: boolean; onClose: () => void; onSaved: () => void; onTemp: (t: { username: string; password: string }) => void }) {
  const toast = useToast();
  const { ask, node } = useConfirm();
  const [f, setF] = useState({ name: s?.name ?? "", username: s?.username ?? "", email: s?.email ?? "", phone: s?.phone ?? "", role_key: s?.role_key ?? "staff", is_active: s?.is_active ?? true });
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<ClientApiError | null>(null);
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const save = async () => {
    setBusy("save");
    setErr(null);
    try {
      if (s) {
        const { username: _u, ...body } = f;
        void _u;
        await apiFetch(`/api/admin/staff/${s.id}`, { method: "PATCH", body });
        toast("Saved");
      } else {
        const r = await apiFetch<{ username: string; temporary_password: string }>("/api/admin/staff", { body: f });
        onTemp({ username: r.username, password: r.temporary_password });
      }
      onSaved();
      onClose();
    } catch (e) {
      setErr(e as ClientApiError);
    } finally {
      setBusy(null);
    }
  };
  const action = async (a: "reset_password" | "sign_out" | "unlock") => {
    if (a === "reset_password") {
      const r = await ask({ title: `Reset ${s!.name}'s password?`, body: "They'll be signed out everywhere and get a one-time password to choose a new one.", confirm: "Reset password" });
      if (!r.ok) return;
    }
    setBusy(a);
    try {
      const r = await apiFetch<{ temporary_password?: string }>(`/api/admin/staff/${s!.id}`, { body: { action: a } });
      if (r.temporary_password) {
        onTemp({ username: s!.username, password: r.temporary_password });
        onClose();
      } else toast(a === "unlock" ? "Account unlocked" : "Signed out of other devices");
      onSaved();
    } catch (e) {
      toast((e as ClientApiError).message, "error");
    } finally {
      setBusy(null);
    }
  };
  const fe = err?.fields ?? {};
  return (
    <Dialog
      open
      side
      onClose={onClose}
      title={s ? s.name : "Add staff"}
      description={s ? `@${s.username}` : "They get a one-time password and choose their own when they first sign in."}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy === "save"} disabled={f.name.trim().length < 2 || (!s && f.username.length < 3)}>
            {s ? "Save" : "Create account"}
          </Button>
        </>
      }
    >
      {node}
      {err && !err.fields && <Notice tone="danger" className="mb-3">{err.message}</Notice>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Full name" htmlFor="st-name" error={fe.name}>
          <Input id="st-name" value={f.name} maxLength={60} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field label="Username" htmlFor="st-user" error={fe.username} hint={s ? "Can't be changed" : "Used to sign in"}>
          <Input id="st-user" value={f.username} disabled={!!s} autoCapitalize="none" maxLength={30} onChange={(e) => set({ username: e.target.value.toLowerCase().replace(/\s/g, "") })} />
        </Field>
        <Field label="Role" htmlFor="st-role" hint={isMe ? "You can't change your own role" : undefined}>
          <Select id="st-role" value={f.role_key} disabled={isMe} onChange={(e) => set({ role_key: e.target.value })}>
            {roles.map((r) => (
              <option key={r.key} value={r.key}>
                {r.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Mobile" htmlFor="st-phone" optional error={fe.phone}>
          <Input id="st-phone" inputMode="numeric" maxLength={10} value={f.phone} onChange={(e) => set({ phone: e.target.value.replace(/\D/g, "") })} />
        </Field>
        <Field label="Email" htmlFor="st-email" optional error={fe.email} className="sm:col-span-2">
          <Input id="st-email" type="email" value={f.email} onChange={(e) => set({ email: e.target.value })} />
        </Field>
      </div>
      {s && !isMe && (
        <>
          <div className="mt-4">
            <Checkbox label="Account active" hint="Deactivated staff are signed out at once and can't sign in. Their history is kept." checked={f.is_active} onChange={(v) => set({ is_active: v })} />
          </div>
          <div className="mt-5 space-y-2 border-t border-line pt-4">
            <p className="eyebrow">Security</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" icon={<KeyRound size={14} />} loading={busy === "reset_password"} onClick={() => action("reset_password")}>
                Reset password
              </Button>
              {s.sessions > 0 && (
                <Button variant="secondary" size="sm" loading={busy === "sign_out"} onClick={() => action("sign_out")}>
                  Sign out of {s.sessions} device{s.sessions === 1 ? "" : "s"}
                </Button>
              )}
              {s.locked && (
                <Button variant="secondary" size="sm" icon={<Lock size={14} />} loading={busy === "unlock"} onClick={() => action("unlock")}>
                  Unlock
                </Button>
              )}
            </div>
          </div>
        </>
      )}
    </Dialog>
  );
}

/* ── Roles ──────────────────────────────────────────────────────────────── */

interface Role {
  key: string;
  name: string;
  description: string;
  permissions: string[];
  is_system: boolean;
  members: number;
}

function RolesTab() {
  const { data, error, loading, reload } = useApi<{ roles: Role[]; catalogue: Record<string, string>; groups: { label: string; perms: string[] }[]; super_admin: string }>("/api/admin/roles");
  const [edit, setEdit] = useState<Role | "new" | null>(null);
  if (error) return <ErrorBlock error={error} retry={reload} />;
  if (loading || !data) return <LoadingBlock rows={4} />;
  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button size="sm" icon={<Plus size={14} />} onClick={() => setEdit("new")}>
          New role
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {data.roles.map((r) => {
          const locked = r.key === data.super_admin;
          return (
            <button key={r.key} type="button" disabled={locked} onClick={() => setEdit(r)} className="rounded-xl border border-line bg-surface p-4 text-left transition-colors hover:border-line-strong disabled:cursor-default disabled:hover:border-line">
              <div className="flex items-start justify-between gap-2">
                <p className="flex items-center gap-1.5 font-semibold">
                  {locked && <ShieldCheck size={15} className="text-accent" aria-hidden />}
                  {r.name}
                </p>
                <span className="text-[12.5px] text-muted">
                  {r.members} member{r.members === 1 ? "" : "s"}
                </span>
              </div>
              <p className="mt-1 text-[13px] text-muted">{r.description}</p>
              <p className="mt-2 text-[12.5px]">{locked ? "Every permission, always" : `${r.permissions.length} of ${Object.keys(data.catalogue).length} permissions`}</p>
            </button>
          );
        })}
      </div>
      {edit && <RoleEditor role={edit === "new" ? null : edit} data={data} onClose={() => setEdit(null)} onSaved={reload} />}
    </>
  );
}

function RoleEditor({ role, data, onClose, onSaved }: { role: Role | null; data: { catalogue: Record<string, string>; groups: { label: string; perms: string[] }[] }; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const { ask, node } = useConfirm();
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [perms, setPerms] = useState<Set<string>>(new Set(role?.permissions ?? ["dashboard.view"]));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<ClientApiError | null>(null);
  const builtIn = !!role && ["manager", "staff", "kitchen"].includes(role.key);
  const toggle = (p: string, on: boolean) =>
    setPerms((s) => {
      const n = new Set(s);
      if (on) n.add(p);
      else n.delete(p);
      // managing something implies being able to see it
      if (on && p.endsWith(".manage") && data.catalogue[p.replace(".manage", ".view")]) n.add(p.replace(".manage", ".view"));
      if (on && p === "kitchen.update") n.add("kitchen.view");
      return n;
    });
  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      const body = { name, description, permissions: [...perms] };
      if (role) await apiFetch(`/api/admin/roles/${role.key}`, { method: "PATCH", body });
      else await apiFetch("/api/admin/roles", { body });
      toast(role ? "Permissions updated — they apply immediately" : "Role created");
      onSaved();
      onClose();
    } catch (e) {
      setErr(e as ClientApiError);
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    const r = await ask({ title: `Delete the ${role!.name} role?`, confirm: "Delete", danger: true });
    if (!r.ok) return;
    try {
      await apiFetch(`/api/admin/roles/${role!.key}`, { method: "DELETE" });
      toast("Role deleted");
      onSaved();
      onClose();
    } catch (e) {
      toast((e as ClientApiError).message, "error");
    }
  };
  return (
    <Dialog
      open
      side
      size="lg"
      onClose={onClose}
      title={role ? `${role.name} permissions` : "New role"}
      description={role ? `${role.members} active member${role.members === 1 ? "" : "s"}` : undefined}
      footer={
        <>
          {role && !builtIn && (
            <Button variant="ghost" className="mr-auto text-danger" onClick={remove}>
              Delete role
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy} disabled={name.trim().length < 2}>
            Save
          </Button>
        </>
      }
    >
      {node}
      {err && <Notice tone="danger" className="mb-3">{err.message}</Notice>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Role name" htmlFor="rl-name">
          <Input id="rl-name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Description" htmlFor="rl-desc" optional>
          <Textarea id="rl-desc" rows={1} maxLength={200} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
      </div>
      <div className="mt-5 space-y-4">
        {data.groups.map((g) => (
          <fieldset key={g.label} className="rounded-xl border border-line p-3">
            <legend className="px-1 text-[13px] font-semibold">{g.label}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {g.perms
                .filter((p) => p !== "staff.manage")
                .map((p) => (
                  <Checkbox key={p} label={data.catalogue[p]} checked={perms.has(p)} onChange={(v) => toggle(p, v)} />
                ))}
            </div>
          </fieldset>
        ))}
        <p className="text-[12.5px] text-muted">Managing staff accounts stays with the Super Admin role.</p>
      </div>
    </Dialog>
  );
}
