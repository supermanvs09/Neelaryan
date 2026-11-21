"use client";

import { useRef, useState } from "react";
import { ImagePlus, Plus, Trash2 } from "lucide-react";
import { Button, Checkbox, Dialog, Field, IconButton, Input, Notice, Select, Tabs, Textarea, useConfirm, useToast } from "../ui";
import { apiFetch, type ClientApiError } from "@/lib/api-client";
import { uploadImage } from "@/lib/image-resize";
import { money, pct } from "@/lib/format";
import { clsx } from "@/lib/clsx";
import { RecipeEditor } from "./RecipeEditor";
import { recipeCost, TAG_LABEL, TAGS, type AdminItem, type AdminMenu } from "./types";

type Form = {
  category_id: string;
  name: string;
  description: string;
  price: string;
  cost_price: string;
  diet: "veg" | "egg" | "nonveg";
  tags: string[];
  image_id: string | null;
  image: string | null;
  visual: "art" | "bowl" | "glass";
  art_kind: string;
  tint: string[];
  status: "available" | "sold_out" | "hidden";
  is_featured: boolean;
  variants: { id?: string; name: string; price: string; cost_price: string; is_default: boolean }[];
  group_ids: string[];
  default_modifier_ids: string[];
  recipe: { inventory_item_id: string; qty: number }[];
};

const toForm = (i: AdminItem | null, menu: AdminMenu): Form =>
  i
    ? {
        category_id: i.category_id,
        name: i.name,
        description: i.description,
        price: String(i.price),
        cost_price: i.cost_price === null ? "" : String(i.cost_price),
        diet: i.diet,
        tags: i.tags,
        image_id: i.image_id,
        image: i.image,
        visual: i.visual,
        art_kind: i.art_kind,
        tint: i.tint,
        status: i.status,
        is_featured: i.is_featured,
        variants: i.variants.filter((v) => v.is_active).map((v) => ({ id: v.id, name: v.name, price: String(v.price), cost_price: v.cost_price === null ? "" : String(v.cost_price), is_default: v.is_default })),
        group_ids: i.group_ids,
        default_modifier_ids: i.default_modifier_ids,
        recipe: i.recipe,
      }
    : {
        category_id: menu.categories[0]?.id ?? "",
        name: "",
        description: "",
        price: "",
        cost_price: "",
        diet: "veg",
        tags: [],
        image_id: null,
        image: null,
        visual: "art",
        art_kind: menu.categories[0]?.art_kind ?? "coffee",
        tint: ["#c98f5a", "#e9cfa8"],
        status: "available",
        is_featured: false,
        variants: [],
        group_ids: [],
        default_modifier_ids: [],
        recipe: [],
      };

export function ItemEditor({ menu, item, onClose, onSaved }: { menu: AdminMenu; item: AdminItem | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const { ask, node } = useConfirm();
  const [f, setF] = useState<Form>(() => toForm(item, menu));
  const [tab, setTab] = useState<"details" | "sizes" | "addons" | "recipe">("details");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<ClientApiError | null>(null);
  const [uploading, setUploading] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));

  const price = Number(f.price) || 0;
  const rCost = recipeCost(f.recipe.filter((r) => r.inventory_item_id && r.qty > 0), menu.inventory);
  const manualCost = f.cost_price === "" ? null : Number(f.cost_price);
  const effectiveCost = rCost ?? manualCost;

  const onUpload = async (fl: File | undefined) => {
    if (!fl) return;
    setUploading(true);
    try {
      const r = await uploadImage(fl);
      setF((x) => ({ ...x, image_id: r.id, image: r.url }));
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      const payload = {
        ...f,
        price: Number(f.price),
        cost_price: f.cost_price === "" ? null : Number(f.cost_price),
        variants: f.variants.map((v) => ({ ...v, price: Number(v.price), cost_price: v.cost_price === "" ? null : Number(v.cost_price) })),
        recipe: f.recipe.filter((r) => r.inventory_item_id && r.qty > 0),
        image: undefined,
      };
      if (item) await apiFetch(`/api/admin/menu/items/${item.id}`, { method: "PATCH", body: payload });
      else await apiFetch("/api/admin/menu/items", { body: payload });
      toast(item ? "Item saved" : "Item added to the menu");
      onSaved();
      onClose();
    } catch (e) {
      setErr(e as ClientApiError);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!item) return;
    const r = await ask({ title: `Remove ${item.name}?`, body: "It disappears from the menu. Past orders and reports keep it.", confirm: "Remove", danger: true });
    if (!r.ok) return;
    try {
      await apiFetch(`/api/admin/menu/items/${item.id}`, { method: "DELETE" });
      toast("Item removed");
      onSaved();
      onClose();
    } catch (e) {
      toast((e as ClientApiError).message, "error");
    }
  };

  const groups = menu.groups.filter((g) => g.is_active);

  return (
    <Dialog
      open
      onClose={onClose}
      side
      size="lg"
      title={item ? `Edit ${item.name}` : "Add menu item"}
      footer={
        <>
          {item && (
            <Button variant="ghost" className="mr-auto text-danger" onClick={remove}>
              Remove item
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy} disabled={!f.name.trim() || f.price === "" || !f.category_id}>
            {item ? "Save changes" : "Add item"}
          </Button>
        </>
      }
    >
      {node}
      <Tabs
        value={tab}
        onChange={setTab}
        className="mb-4"
        items={[
          { value: "details", label: "Details" },
          { value: "sizes", label: `Sizes${f.variants.length ? ` (${f.variants.length})` : ""}` },
          { value: "addons", label: `Add-ons${f.group_ids.length ? ` (${f.group_ids.length})` : ""}` },
          { value: "recipe", label: `Recipe & cost${f.recipe.length ? ` (${f.recipe.length})` : ""}` },
        ]}
      />
      {err && <Notice tone="danger" className="mb-3">{err.message}</Notice>}

      {tab === "details" && (
        <div className="grid gap-4 md:grid-cols-[1fr_180px]">
          <div className="space-y-4">
            <Field label="Name" htmlFor="it-name" error={err?.fields?.name}>
              <Input id="it-name" value={f.name} maxLength={80} onChange={(e) => set("name", e.target.value)} invalid={!!err?.fields?.name} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Category" htmlFor="it-cat">
                <Select id="it-cat" value={f.category_id} onChange={(e) => set("category_id", e.target.value)}>
                  {menu.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Food type" htmlFor="it-diet">
                <Select id="it-diet" value={f.diet} onChange={(e) => set("diet", e.target.value as Form["diet"])}>
                  <option value="veg">Vegetarian</option>
                  <option value="egg">Contains egg</option>
                  <option value="nonveg">Non-vegetarian</option>
                </Select>
              </Field>
              <Field label="Price" htmlFor="it-price" error={err?.fields?.price} hint={f.variants.length ? "Sizes below set the actual price." : undefined}>
                <Input id="it-price" type="number" inputMode="decimal" min={0} step="0.5" prefix="₹" value={f.price} onChange={(e) => set("price", e.target.value)} invalid={!!err?.fields?.price} />
              </Field>
              <Field label="Availability" htmlFor="it-status">
                <Select id="it-status" value={f.status} onChange={(e) => set("status", e.target.value as Form["status"])}>
                  <option value="available">Available</option>
                  <option value="sold_out">Sold out</option>
                  <option value="hidden">Hidden from menu</option>
                </Select>
              </Field>
            </div>
            <Field label="Description" htmlFor="it-desc" optional>
              <Textarea id="it-desc" value={f.description} maxLength={300} rows={3} onChange={(e) => set("description", e.target.value)} />
            </Field>
            <div>
              <p className="mb-1.5 text-[13px] font-semibold">Labels</p>
              <div className="flex flex-wrap gap-1.5">
                {TAGS.map((t) => {
                  const on = f.tags.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={on}
                      onClick={() => set("tags", on ? f.tags.filter((x) => x !== t) : [...f.tags, t])}
                      className={clsx("h-8 rounded-md border px-2.5 text-[13px] font-semibold", on ? "border-primary bg-primary-soft text-fg" : "border-line text-muted hover:text-fg")}
                    >
                      {TAG_LABEL[t]}
                    </button>
                  );
                })}
              </div>
            </div>
            <Checkbox label="Feature on the home page" checked={f.is_featured} onChange={(v) => set("is_featured", v)} />
          </div>
          <div>
            <p className="mb-1.5 text-[13px] font-semibold">Photo</p>
            <button
              type="button"
              onClick={() => file.current?.click()}
              className="relative grid aspect-square w-full place-items-center overflow-hidden rounded-lg border border-dashed border-line-strong bg-surface-2 text-muted hover:text-fg"
            >
              {f.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={f.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <span className="flex flex-col items-center gap-1 text-[12.5px]">
                  <ImagePlus size={22} /> {uploading ? "Uploading…" : "Upload photo"}
                </span>
              )}
            </button>
            <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => onUpload(e.target.files?.[0])} />
            {f.image && (
              <button type="button" className="mt-1.5 text-[12.5px] font-semibold text-danger" onClick={() => setF((x) => ({ ...x, image_id: null, image: null }))}>
                Remove photo
              </button>
            )}
            <p className="mt-1.5 text-[12px] text-muted">Without a photo the menu shows the item's illustration.</p>
          </div>
        </div>
      )}

      {tab === "sizes" && (
        <div className="space-y-3">
          <p className="text-[13.5px] text-muted">Add sizes (e.g. Regular / Large) when the price changes by size. Leave empty for a single price.</p>
          {f.variants.map((v, i) => (
            <div key={i} className="flex flex-wrap items-end gap-2 rounded-lg border border-line p-3">
              <Field label="Size name" className="min-w-[140px] flex-1">
                <Input value={v.name} maxLength={40} onChange={(e) => set("variants", f.variants.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              </Field>
              <Field label="Price" className="w-[120px]">
                <Input type="number" min={0} prefix="₹" value={v.price} onChange={(e) => set("variants", f.variants.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} />
              </Field>
              <Field label="Cost" className="w-[120px]" optional>
                <Input type="number" min={0} prefix="₹" value={v.cost_price} onChange={(e) => set("variants", f.variants.map((x, j) => (j === i ? { ...x, cost_price: e.target.value } : x)))} />
              </Field>
              <label className="flex h-10 items-center gap-2 text-[13px]">
                <input type="radio" name="default-variant" checked={v.is_default} onChange={() => set("variants", f.variants.map((x, j) => ({ ...x, is_default: j === i })))} /> Default
              </label>
              <IconButton label="Remove size" onClick={() => set("variants", f.variants.filter((_, j) => j !== i))}>
                <Trash2 size={15} />
              </IconButton>
            </div>
          ))}
          <Button variant="secondary" size="sm" icon={<Plus size={14} />} onClick={() => set("variants", [...f.variants, { name: "", price: f.price, cost_price: "", is_default: f.variants.length === 0 }])}>
            Add size
          </Button>
        </div>
      )}

      {tab === "addons" && (
        <div className="space-y-3">
          <p className="text-[13.5px] text-muted">
            Tick the groups this item offers. Mark options as <b>included</b> when they're part of the dish — they show as “Included” and removing them never lowers the price.
          </p>
          {groups.map((g) => {
            const on = f.group_ids.includes(g.id);
            return (
              <div key={g.id} className={clsx("rounded-lg border p-3", on ? "border-primary/50 bg-primary-soft/40" : "border-line")}>
                <Checkbox
                  label={<b>{g.name}</b>}
                  hint={g.selection === "single" ? "Choose one" : g.max_select ? `Up to ${g.max_select}` : "Any number"}
                  checked={on}
                  onChange={(v) =>
                    setF((x) => ({
                      ...x,
                      group_ids: v ? [...x.group_ids, g.id] : x.group_ids.filter((id) => id !== g.id),
                      default_modifier_ids: v ? x.default_modifier_ids : x.default_modifier_ids.filter((m) => !g.modifiers.some((gm) => gm.id === m)),
                    }))
                  }
                />
                {on && (
                  <div className="mt-2 flex flex-wrap gap-1.5 pl-6">
                    {g.modifiers
                      .filter((m) => m.is_active)
                      .map((m) => {
                        const inc = f.default_modifier_ids.includes(m.id);
                        return (
                          <button
                            key={m.id}
                            type="button"
                            aria-pressed={inc}
                            onClick={() =>
                              setF((x) => {
                                let next = inc ? x.default_modifier_ids.filter((id) => id !== m.id) : [...x.default_modifier_ids, m.id];
                                // single-choice groups have one default at most
                                if (!inc && g.selection === "single") next = next.filter((id) => id === m.id || !g.modifiers.some((gm) => gm.id === id));
                                return { ...x, default_modifier_ids: next };
                              })
                            }
                            className={clsx("h-8 rounded-md border px-2.5 text-[12.5px] font-semibold", inc ? "border-success bg-success-soft text-success" : "border-line text-muted hover:text-fg")}
                          >
                            {m.name}
                            {m.price ? ` +₹${m.price}` : ""} {inc && "· included"}
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === "recipe" && (
        <div className="space-y-4">
          <p className="text-[13.5px] text-muted">
            When this item is ordered and the kitchen accepts it, these ingredients are taken out of stock automatically (and put back if the order is cancelled). Quantities are per one item.
          </p>
          <RecipeEditor lines={f.recipe} onChange={(r) => set("recipe", r)} inventory={menu.inventory} />
          <div className="grid gap-3 rounded-lg border border-line bg-surface-2/50 p-3 sm:grid-cols-3">
            <div>
              <p className="text-[12px] text-muted">Ingredient cost</p>
              <p className="num text-[18px] font-bold">{rCost === null ? (f.recipe.length ? "Some costs missing" : "—") : money(rCost)}</p>
            </div>
            <Field label="Manual cost (no recipe)" htmlFor="it-cost" hint="Used only when there's no recipe.">
              <Input id="it-cost" type="number" min={0} step="0.5" prefix="₹" value={f.cost_price} onChange={(e) => set("cost_price", e.target.value)} />
            </Field>
            <div>
              <p className="text-[12px] text-muted">Margin at {money(price)}</p>
              <p className="num text-[18px] font-bold">{effectiveCost === null || !price ? "—" : `${money(price - effectiveCost)} · ${pct((price - effectiveCost) / price, 0)}`}</p>
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
}
