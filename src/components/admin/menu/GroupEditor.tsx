"use client";

import { useState } from "react";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { Button, Dialog, Field, IconButton, Input, Notice, Select, Switch, Textarea, useConfirm, useToast } from "../ui";
import { apiFetch, type ClientApiError } from "@/lib/api-client";
import { RecipeEditor } from "./RecipeEditor";
import type { AdminGroup, AdminMenu } from "./types";

type Opt = { id?: string; name: string; price: string; cost_price: string; visual_key: string | null; is_active: boolean; recipe: { inventory_item_id: string; qty: number }[]; open?: boolean };

export function GroupEditor({ menu, group, onClose, onSaved }: { menu: AdminMenu; group: AdminGroup | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const { ask, node } = useConfirm();
  const [name, setName] = useState(group?.name ?? "");
  const [description, setDescription] = useState(group?.description ?? "");
  const [selection, setSelection] = useState<"single" | "multi">(group?.selection ?? "multi");
  const [min, setMin] = useState(String(group?.min_select ?? 0));
  const [max, setMax] = useState(group?.max_select ? String(group.max_select) : "");
  const [opts, setOpts] = useState<Opt[]>(
    group?.modifiers.filter((m) => m.is_active).map((m) => ({ id: m.id, name: m.name, price: String(m.price), cost_price: m.cost_price === null ? "" : String(m.cost_price), visual_key: m.visual_key, is_active: m.is_active, recipe: m.recipe })) ?? [
      { name: "", price: "0", cost_price: "", visual_key: null, is_active: true, recipe: [] },
    ],
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<ClientApiError | null>(null);
  const setOpt = (i: number, patch: Partial<Opt>) => setOpts((o) => o.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      const payload = {
        name,
        description,
        selection,
        min_select: Number(min) || 0,
        max_select: selection === "single" ? 1 : max ? Number(max) : null,
        is_active: true,
        modifiers: opts.map((o) => ({ id: o.id, name: o.name, price: Number(o.price) || 0, cost_price: o.cost_price === "" ? null : Number(o.cost_price), visual_key: o.visual_key, is_active: o.is_active, recipe: o.recipe.filter((r) => r.inventory_item_id && r.qty > 0) })),
      };
      if (group) await apiFetch(`/api/admin/menu/groups/${group.id}`, { method: "PATCH", body: payload });
      else await apiFetch("/api/admin/menu/groups", { body: payload });
      toast("Add-on group saved");
      onSaved();
      onClose();
    } catch (e) {
      setErr(e as ClientApiError);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!group) return;
    const used = menu.items.filter((i) => i.group_ids.includes(group.id)).length;
    const r = await ask({ title: `Remove “${group.name}”?`, body: used ? `It's used by ${used} item${used === 1 ? "" : "s"} and will disappear from their customiser.` : "It isn't used by any item.", confirm: "Remove", danger: true });
    if (!r.ok) return;
    await apiFetch(`/api/admin/menu/groups/${group.id}`, { method: "DELETE" }).then(
      () => {
        toast("Group removed");
        onSaved();
        onClose();
      },
      (e) => toast((e as ClientApiError).message, "error"),
    );
  };

  return (
    <Dialog
      open
      onClose={onClose}
      side
      size="lg"
      title={group ? `Edit ${group.name}` : "Add add-on group"}
      footer={
        <>
          {group && (
            <Button variant="ghost" className="mr-auto text-danger" onClick={remove}>
              Remove group
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy} disabled={!name.trim() || !opts.some((o) => o.name.trim())}>
            Save group
          </Button>
        </>
      }
    >
      {node}
      {err && <Notice tone="danger" className="mb-3">{err.message}</Notice>}
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Group name" htmlFor="g-name" hint="Shown to customers, e.g. “Toppings” or “Milk”.">
          <Input id="g-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Customers can" htmlFor="g-sel">
          <Select id="g-sel" value={selection} onChange={(e) => setSelection(e.target.value as "single" | "multi")}>
            <option value="single">Choose exactly one</option>
            <option value="multi">Choose several</option>
          </Select>
        </Field>
        {selection === "multi" && (
          <>
            <Field label="Minimum" htmlFor="g-min">
              <Input id="g-min" type="number" min={0} value={min} onChange={(e) => setMin(e.target.value)} />
            </Field>
            <Field label="Maximum" htmlFor="g-max" optional hint="Leave empty for no limit.">
              <Input id="g-max" type="number" min={1} value={max} onChange={(e) => setMax(e.target.value)} />
            </Field>
          </>
        )}
        <Field label="Note for customers" htmlFor="g-desc" optional className="md:col-span-2">
          <Textarea id="g-desc" rows={2} value={description} maxLength={200} onChange={(e) => setDescription(e.target.value)} />
        </Field>
      </div>

      <h3 className="mb-2 mt-5 text-[14px] font-bold">Options</h3>
      <div className="space-y-2">
        {opts.map((o, i) => (
          <div key={o.id ?? i} className="rounded-lg border border-line p-3">
            <div className="flex flex-wrap items-end gap-2">
              <Field label="Option" className="min-w-[150px] flex-1">
                <Input value={o.name} maxLength={60} onChange={(e) => setOpt(i, { name: e.target.value })} />
              </Field>
              <Field label="Price" className="w-[110px]">
                <Input type="number" min={0} step="0.5" prefix="₹" value={o.price} onChange={(e) => setOpt(i, { price: e.target.value })} />
              </Field>
              <Field label="Cost" className="w-[110px]" optional>
                <Input type="number" min={0} step="0.5" prefix="₹" value={o.cost_price} onChange={(e) => setOpt(i, { cost_price: e.target.value })} />
              </Field>
              <div className="flex h-10 items-center gap-2">
                <Switch checked={o.is_active} onChange={(v) => setOpt(i, { is_active: v })} label={`${o.name || "Option"} available`} />
              </div>
              <IconButton label="Ingredients used" onClick={() => setOpt(i, { open: !o.open })}>
                <ChevronDown size={16} className={o.open ? "rotate-180" : ""} />
              </IconButton>
              <IconButton label="Remove option" onClick={() => setOpts((x) => x.filter((_, j) => j !== i))}>
                <Trash2 size={15} />
              </IconButton>
            </div>
            {(o.open || o.recipe.length > 0) && (
              <div className="mt-3 border-t border-line pt-3">
                <p className="mb-2 text-[12.5px] text-muted">Extra ingredients this option uses (deducted from stock with the order).</p>
                <RecipeEditor compact lines={o.recipe} onChange={(r) => setOpt(i, { recipe: r })} inventory={menu.inventory} />
              </div>
            )}
          </div>
        ))}
        <Button size="sm" variant="secondary" icon={<Plus size={14} />} onClick={() => setOpts((x) => [...x, { name: "", price: "0", cost_price: "", visual_key: null, is_active: true, recipe: [] }])}>
          Add option
        </Button>
      </div>
    </Dialog>
  );
}
