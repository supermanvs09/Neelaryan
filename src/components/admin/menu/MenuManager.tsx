"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, Search } from "lucide-react";
import { Badge, Button, Card, DataTable, Empty, ErrorBlock, IconButton, Input, LoadingBlock, PageHeader, Select, Tabs, useToast } from "../ui";
import { useCan } from "../AdminShell";
import { apiFetch, useApi, type ClientApiError } from "@/lib/api-client";
import { money, pct, plural } from "@/lib/format";
import { FoodArt } from "@/components/food/FoodArt";
import type { ArtKind } from "@/data/menu";
import { clsx } from "@/lib/clsx";
import { ItemEditor } from "./ItemEditor";
import { GroupEditor } from "./GroupEditor";
import { CategoryEditor } from "./CategoryEditor";
import { recipeCost, STATUS_LABEL, type AdminCategory, type AdminGroup, type AdminItem, type AdminMenu } from "./types";
import { DietMark } from "@/components/ui/bits";

type Tab = "items" | "categories" | "groups";

export function MenuManager() {
  const { data, error, loading, reload } = useApi<AdminMenu>("/api/admin/menu");
  const [tab, setTab] = useState<Tab>("items");
  const can = useCan();
  const manage = can("menu.manage");

  return (
    <>
      <PageHeader
        title="Menu"
        description="What customers see on the QR menu and website. Changes appear on the customer menu immediately."
        actions={manage && tab === "items" ? <NewItemButton onSaved={reload} menu={data} /> : undefined}
      />
      <Tabs
        value={tab}
        onChange={setTab}
        className="mb-4"
        items={[
          { value: "items", label: `Items${data ? ` (${data.items.length})` : ""}` },
          { value: "categories", label: "Categories" },
          { value: "groups", label: "Add-ons & options" },
        ]}
      />
      <ErrorBlock error={error} retry={reload} />
      {loading || !data ? (
        <LoadingBlock rows={8} />
      ) : tab === "items" ? (
        <Items menu={data} reload={reload} manage={manage} />
      ) : tab === "categories" ? (
        <Categories menu={data} reload={reload} manage={manage} />
      ) : (
        <Groups menu={data} reload={reload} manage={manage} />
      )}
    </>
  );
}

function NewItemButton({ menu, onSaved }: { menu?: AdminMenu; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button icon={<Plus size={16} />} onClick={() => setOpen(true)} disabled={!menu}>
        Add item
      </Button>
      {menu && open && <ItemEditor menu={menu} item={null} onClose={() => setOpen(false)} onSaved={onSaved} />}
    </>
  );
}

function Items({ menu, reload, manage }: { menu: AdminMenu; reload: () => Promise<void>; manage: boolean }) {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [status, setStatus] = useState("all");
  const [editing, setEditing] = useState<AdminItem | null>(null);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return menu.items.filter((i) => (cat === "all" || i.category_id === cat) && (status === "all" || i.status === status) && (!s || i.name.toLowerCase().includes(s)));
  }, [menu.items, q, cat, status]);

  const setItemStatus = async (item: AdminItem, next: AdminItem["status"]) => {
    try {
      await apiFetch(`/api/admin/menu/items/${item.id}/status`, { body: { status: next } });
      toast(`${item.name} is now ${STATUS_LABEL[next].toLowerCase()}`);
      await reload();
    } catch (e) {
      toast((e as ClientApiError).message, "error");
    }
  };

  const move = async (item: AdminItem, dir: -1 | 1) => {
    const same = menu.items.filter((i) => i.category_id === item.category_id);
    const idx = same.findIndex((i) => i.id === item.id);
    const j = idx + dir;
    if (j < 0 || j >= same.length) return;
    const ids = same.map((i) => i.id);
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    await apiFetch("/api/admin/menu/reorder", { body: { kind: "items", ids } }).catch((e) => toast((e as ClientApiError).message, "error"));
    await reload();
  };

  const catName = (id: string) => menu.categories.find((c) => c.id === id)?.name ?? "—";
  const cost = (i: AdminItem) => recipeCost(i.recipe, menu.inventory) ?? i.cost_price;

  return (
    <Card padded={false}>
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
        <div className="relative min-w-[200px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <Input placeholder="Search items" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" aria-label="Search items" />
        </div>
        <Select value={cat} onChange={(e) => setCat(e.target.value)} className="w-auto min-w-[180px]" aria-label="Category">
          <option value="all">All categories</option>
          {menu.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto" aria-label="Availability">
          <option value="all">Any availability</option>
          <option value="available">Available</option>
          <option value="sold_out">Sold out</option>
          <option value="hidden">Hidden</option>
        </Select>
      </div>
      <DataTable
        rows={filtered}
        rowKey={(r) => r.id}
        onRowClick={manage ? setEditing : undefined}
        empty={<Empty title="No items match">Try another search or filter.</Empty>}
        columns={[
          {
            key: "name",
            header: "Item",
            primary: true,
            cell: (i) => (
              <span className="flex items-center gap-3">
                {i.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={i.image} alt="" className="h-10 w-10 shrink-0 rounded-md object-cover" />
                ) : (
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-surface-2">
                    <FoodArt kind={(i.visual === "bowl" ? "oats" : i.visual === "glass" ? "shake" : i.art_kind) as ArtKind} tint={[i.tint[0] ?? "#c98f5a", i.tint[1] ?? "#e9cfa8"]} className="h-8 w-8" />
                  </span>
                )}
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 font-semibold">
                    <DietMark diet={i.diet} /> <span className="truncate">{i.name}</span>
                  </span>
                  <span className="block text-[12.5px] text-muted">
                    {i.variants.filter((v) => v.is_active).length ? `${i.variants.filter((v) => v.is_active).length} sizes · ` : ""}
                    {i.group_ids.length ? plural(i.group_ids.length, "add-on group") : "No add-ons"}
                    {i.recipe.length ? ` · recipe` : ""}
                  </span>
                </span>
              </span>
            ),
          },
          { key: "cat", header: "Category", cell: (i) => catName(i.category_id) },
          { key: "price", header: "Price", align: "right", cell: (i) => <span className="num">{money(i.price)}</span> },
          {
            key: "margin",
            header: "Cost · margin",
            align: "right",
            cell: (i) => {
              const c = cost(i);
              return c === null ? <span className="text-muted">Not set</span> : <span className="num">{money(c)} · {pct((i.price - c) / (i.price || 1), 0)}</span>;
            },
          },
          {
            key: "status",
            header: "Availability",
            cell: (i) =>
              manage ? (
                <span onClick={(e) => e.stopPropagation()}>
                  <Select
                    value={i.status}
                    onChange={(e) => setItemStatus(i, e.target.value as AdminItem["status"])}
                    className={clsx("h-8 w-[130px] text-[13px]", i.status === "sold_out" && "text-danger", i.status === "hidden" && "text-muted")}
                    aria-label={`Availability of ${i.name}`}
                  >
                    <option value="available">Available</option>
                    <option value="sold_out">Sold out</option>
                    <option value="hidden">Hidden</option>
                  </Select>
                </span>
              ) : (
                <Badge tone={i.status === "available" ? "success" : i.status === "sold_out" ? "danger" : "neutral"}>{STATUS_LABEL[i.status]}</Badge>
              ),
          },
          ...(manage
            ? [
                {
                  key: "order",
                  header: "Order",
                  hideOnCard: true,
                  cell: (i: AdminItem) => (
                    <span className="flex" onClick={(e) => e.stopPropagation()}>
                      <IconButton label={`Move ${i.name} up`} onClick={() => move(i, -1)}>
                        <ArrowUp size={15} />
                      </IconButton>
                      <IconButton label={`Move ${i.name} down`} onClick={() => move(i, 1)}>
                        <ArrowDown size={15} />
                      </IconButton>
                      <IconButton label={`Edit ${i.name}`} onClick={() => setEditing(i)}>
                        <Pencil size={15} />
                      </IconButton>
                    </span>
                  ),
                },
              ]
            : []),
        ]}
      />
      {editing && <ItemEditor menu={menu} item={editing} onClose={() => setEditing(null)} onSaved={reload} />}
    </Card>
  );
}

function Categories({ menu, reload, manage }: { menu: AdminMenu; reload: () => Promise<void>; manage: boolean }) {
  const toast = useToast();
  const [editing, setEditing] = useState<AdminCategory | "new" | null>(null);
  const move = async (idx: number, dir: -1 | 1) => {
    const ids = menu.categories.map((c) => c.id);
    const j = idx + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    await apiFetch("/api/admin/menu/reorder", { body: { kind: "categories", ids } }).catch((e) => toast((e as ClientApiError).message, "error"));
    await reload();
  };
  return (
    <Card
      padded={false}
      title="Categories"
      description="The order here is the order on the customer menu."
      actions={
        manage && (
          <Button size="sm" icon={<Plus size={15} />} onClick={() => setEditing("new")}>
            Add category
          </Button>
        )
      }
    >
      <DataTable
        rows={menu.categories}
        rowKey={(c) => c.id}
        onRowClick={manage ? setEditing : undefined}
        columns={[
          { key: "name", header: "Name", primary: true, cell: (c) => <span className="font-semibold">{c.name}</span> },
          { key: "count", header: "Items", align: "right", cell: (c) => menu.items.filter((i) => i.category_id === c.id).length },
          { key: "state", header: "Shown", cell: (c) => (c.is_active ? <Badge tone="success">Shown</Badge> : <Badge>Hidden</Badge>) },
          ...(manage
            ? [
                {
                  key: "order",
                  header: "Order",
                  hideOnCard: true,
                  cell: (c: AdminCategory) => {
                    const idx = menu.categories.indexOf(c);
                    return (
                      <span className="flex" onClick={(e) => e.stopPropagation()}>
                        <IconButton label={`Move ${c.name} up`} onClick={() => move(idx, -1)}>
                          <ArrowUp size={15} />
                        </IconButton>
                        <IconButton label={`Move ${c.name} down`} onClick={() => move(idx, 1)}>
                          <ArrowDown size={15} />
                        </IconButton>
                      </span>
                    );
                  },
                },
              ]
            : []),
        ]}
      />
      {editing && <CategoryEditor category={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={reload} />}
    </Card>
  );
}

function Groups({ menu, reload, manage }: { menu: AdminMenu; reload: () => Promise<void>; manage: boolean }) {
  const [editing, setEditing] = useState<AdminGroup | "new" | null>(null);
  return (
    <Card
      padded={false}
      title="Add-on & option groups"
      description="Reusable groups (sizes of milk, toppings, spice level…). Attach them to items in the item editor."
      actions={
        manage && (
          <Button size="sm" icon={<Plus size={15} />} onClick={() => setEditing("new")}>
            Add group
          </Button>
        )
      }
    >
      <DataTable
        rows={menu.groups.filter((g) => g.is_active)}
        rowKey={(g) => g.id}
        onRowClick={manage ? setEditing : undefined}
        columns={[
          { key: "name", header: "Group", primary: true, cell: (g) => <span className="font-semibold">{g.name}</span> },
          { key: "rule", header: "Rule", cell: (g) => (g.selection === "single" ? "Choose one" : g.max_select ? `Up to ${g.max_select}` : "Any number") },
          {
            key: "options",
            header: "Options",
            cell: (g) => (
              <span className="line-clamp-2 text-[13px] text-muted">
                {g.modifiers
                  .filter((m) => m.is_active)
                  .map((m) => (m.price ? `${m.name} +₹${m.price}` : m.name))
                  .join(", ")}
              </span>
            ),
          },
          { key: "used", header: "Used by", align: "right", cell: (g) => `${menu.items.filter((i) => i.group_ids.includes(g.id)).length} items` },
        ]}
      />
      {editing && <GroupEditor menu={menu} group={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={reload} />}
    </Card>
  );
}
