"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, Search, ShoppingBag, Trash2 } from "lucide-react";
import { Badge, Button, Dialog, ErrorBlock, Field, Input, LoadingBlock, Notice, PageHeader, Segmented, Select, Textarea, useToast } from "../ui";
import { useCan } from "../AdminShell";
import { apiFetch, useApi, type ClientApiError } from "@/lib/api-client";
import { billTotals, priceLine, round2, type PricingMenu } from "@/lib/pricing";
import { money } from "@/lib/format";
import { clsx } from "@/lib/clsx";

interface PosMenu extends PricingMenu {
  categories: { id: string; name: string }[];
  items: (PricingMenu["items"][number] & { category_id: string; diet: string; description: string })[];
  groups: (PricingMenu["groups"][number] & { description: string })[];
  tax: { gst_percent: number; service_charge_percent: number };
  tables: { id: string; label: string; area: string; occupied: boolean }[];
  products: { id: string; name: string; sell_unit_name: string; available: number; retail_price: number | null; wholesale_price: number | null; category: string | null }[];
}

interface CartLine {
  key: string;
  kind: "menu" | "product";
  id: string;
  variant_id?: string | null;
  modifier_ids?: string[];
  qty: number;
  notes?: string;
}

const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

export function PosPage() {
  const { data, error, loading, reload } = useApi<PosMenu>("/api/admin/pos");
  const router = useRouter();
  const toast = useToast();
  const can = useCan();
  const canDiscount = can("billing.refund") || can("finance.view");

  const [mode, setMode] = useState<"menu" | "retail" | "wholesale">("menu");
  const [cat, setCat] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [type, setType] = useState<"dine_in" | "takeaway">("dine_in");
  const [tableId, setTableId] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [discount, setDiscount] = useState("");
  const [config, setConfig] = useState<{ itemId: string; line?: CartLine } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<ClientApiError | null>(null);
  const [key, setKey] = useState(uid);

  const tier = mode === "wholesale" ? "wholesale" : "retail";
  const hasProducts = cart.some((l) => l.kind === "product");
  const hasMenu = cart.some((l) => l.kind === "menu");

  const priced = useMemo(() => {
    if (!data) return [];
    return cart.map((l) => {
      if (l.kind === "menu") {
        const p = priceLine(data, { item_id: l.id, variant_id: l.variant_id, modifier_ids: l.modifier_ids, qty: l.qty });
        return p.ok
          ? { line: l, title: p.name + (p.variant ? ` · ${p.variant.name}` : ""), detail: [...p.modifiers.map((m) => m.name), ...p.removed.map((r) => `No ${r}`)].join(", "), unit: p.unitPrice, total: p.lineTotal, error: null as string | null }
          : { line: l, title: data.items.find((i) => i.id === l.id)?.name ?? "Item", detail: "", unit: 0, total: 0, error: p.error };
      }
      const pr = data.products.find((p) => p.id === l.id);
      const unit = pr ? (tier === "wholesale" ? pr.wholesale_price ?? pr.retail_price : pr.retail_price) : null;
      const over = pr && l.qty > pr.available;
      return {
        line: l,
        title: pr?.name ?? "Product",
        detail: pr?.sell_unit_name ?? "",
        unit: unit ?? 0,
        total: round2((unit ?? 0) * l.qty),
        error: !pr ? "No longer for sale" : unit === null ? `No ${tier} price set` : over ? `Only ${pr.available} in stock` : null,
      };
    });
  }, [cart, data, tier]);

  const subtotal = round2(priced.reduce((s, p) => s + p.total, 0));
  const disc = canDiscount ? Math.min(Number(discount) || 0, subtotal) : 0;
  const totals = data ? billTotals(subtotal, disc, data.tax) : null;
  const blocking = priced.find((p) => p.error);

  const items = useMemo(() => {
    if (!data) return [];
    const s = query.trim().toLowerCase();
    return data.items.filter((i) => (cat === "all" || i.category_id === cat) && (!s || i.name.toLowerCase().includes(s)));
  }, [data, cat, query]);
  const products = useMemo(() => {
    if (!data) return [];
    const s = query.trim().toLowerCase();
    return data.products.filter((p) => !s || p.name.toLowerCase().includes(s));
  }, [data, query]);

  const addMenu = (itemId: string) => {
    const it = data!.items.find((i) => i.id === itemId)!;
    if (it.group_ids.length || it.variants.length > 1) setConfig({ itemId });
    else pushLine({ key: uid(), kind: "menu", id: itemId, variant_id: it.variants[0]?.id ?? null, modifier_ids: [], qty: 1 });
  };
  const pushLine = (l: CartLine) => {
    setCart((c) => {
      const same = c.find((x) => x.kind === l.kind && x.id === l.id && x.variant_id === l.variant_id && (x.modifier_ids ?? []).slice().sort().join() === (l.modifier_ids ?? []).slice().sort().join() && !x.notes && !l.notes);
      if (same) return c.map((x) => (x === same ? { ...x, qty: Math.min(x.kind === "product" ? 999 : 50, x.qty + l.qty) } : x));
      return [...c, l];
    });
  };
  const setQty = (k: string, qty: number) => setCart((c) => (qty <= 0 ? c.filter((x) => x.key !== k) : c.map((x) => (x.key === k ? { ...x, qty: Math.min(x.kind === "product" ? 999 : 50, qty) } : x))));

  const switchMode = (m: typeof mode) => {
    // Menu dishes and wholesale goods never share a bill — wholesale is a trade sale at trade prices.
    if (m === "wholesale" && hasMenu) {
      toast("Clear the café items first — a wholesale bill holds products only.", "error");
      return;
    }
    if (m === "menu" && tier === "wholesale" && hasProducts) {
      toast("Finish or clear the wholesale bill first.", "error");
      return;
    }
    setMode(m);
    if (m === "wholesale") setType("takeaway");
  };

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await apiFetch<{ id: string; number: number; total: number }>("/api/admin/orders", {
        body: {
          idempotency_key: key,
          type,
          table_id: type === "dine_in" ? tableId || null : null,
          tier,
          customer_name: name,
          customer_phone: phone,
          notes,
          discount: disc,
          lines: cart.filter((l) => l.kind === "menu").map((l) => ({ item_id: l.id, variant_id: l.variant_id ?? null, modifier_ids: l.modifier_ids ?? [], qty: l.qty, notes: l.notes || undefined })),
          products: cart.filter((l) => l.kind === "product").map((l) => ({ product_id: l.id, qty: l.qty })),
        },
      });
      toast(`Order #${r.number} placed · ${money(r.total)}`);
      setCart([]);
      setName("");
      setPhone("");
      setNotes("");
      setDiscount("");
      setKey(uid());
      reload();
      router.push(`/admin/orders?open=${r.id}`);
    } catch (e) {
      setErr(e as ClientApiError);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingBlock rows={8} />;
  if (error || !data) return <ErrorBlock error={error} retry={reload} />;

  const tierPrice = (p: PosMenu["products"][number]) => (tier === "wholesale" ? p.wholesale_price ?? p.retail_price : p.retail_price);

  return (
    <>
      <PageHeader title="New order" description="Take an order at the counter. It goes straight to the kitchen." />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Catalogue */}
        <section aria-label="Menu" className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {data.products.length > 0 && (
              <Segmented
                label="What are you selling"
                value={mode}
                onChange={switchMode}
                items={[
                  { value: "menu", label: "Café menu" },
                  { value: "retail", label: "Products" },
                  { value: "wholesale", label: "Wholesale" },
                ]}
              />
            )}
            <div className="min-w-[200px] flex-1">
              <Input aria-label="Search" placeholder={mode === "menu" ? "Search dishes" : "Search products"} value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
          </div>
          {mode === "menu" ? (
            <>
              <div className="no-scrollbar -mx-1 mb-3 flex gap-1 overflow-x-auto px-1">
                {[{ id: "all", name: "All" }, ...data.categories].map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCat(c.id)}
                    className={clsx("h-9 shrink-0 rounded-full border px-3.5 text-[13px] font-semibold transition-colors", cat === c.id ? "border-primary bg-primary text-primary-fg" : "border-line bg-surface hover:border-line-strong")}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
              {!items.length ? (
                <p className="py-10 text-center text-muted">
                  <Search size={18} className="mx-auto mb-2" aria-hidden />
                  Nothing matches “{query}”.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                  {items.map((i) => {
                    const off = i.status !== "available";
                    const from = i.variants.length ? Math.min(...i.variants.map((v) => v.price)) : i.price;
                    return (
                      <button
                        key={i.id}
                        type="button"
                        disabled={off}
                        onClick={() => addMenu(i.id)}
                        className="flex min-h-[86px] flex-col justify-between rounded-xl border border-line bg-surface p-3 text-left transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <span className="flex items-start gap-1.5 text-[14px] font-semibold leading-snug">
                          <span aria-label={i.diet === "veg" ? "Vegetarian" : i.diet} className={clsx("mt-1 h-2.5 w-2.5 shrink-0 rounded-sm border-2", i.diet === "veg" ? "border-success" : i.diet === "egg" ? "border-warning" : "border-danger")} />
                          {i.name}
                        </span>
                        <span className="mt-2 flex items-center justify-between text-[13px]">
                          <span className="num font-semibold">
                            {i.variants.length > 1 && <span className="font-normal text-muted">from </span>}
                            {money(from)}
                          </span>
                          {off ? <Badge tone="danger">Sold out</Badge> : i.group_ids.length > 0 && <span className="text-[12px] text-muted">Options</span>}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          ) : !products.length ? (
            <p className="py-10 text-center text-muted">No products for sale. Mark an inventory item as sellable and give it a price to sell it here.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
              {products.map((p) => {
                const price = tierPrice(p);
                const inCart = cart.find((l) => l.kind === "product" && l.id === p.id)?.qty ?? 0;
                const off = price === null || p.available - inCart <= 0;
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={off}
                    onClick={() => pushLine({ key: uid(), kind: "product", id: p.id, qty: 1 })}
                    className="flex min-h-[86px] flex-col justify-between rounded-xl border border-line bg-surface p-3 text-left transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="text-[14px] font-semibold leading-snug">{p.name}</span>
                    <span className="text-[12px] text-muted">
                      per {p.sell_unit_name} · {p.available} in stock
                    </span>
                    <span className="num mt-1 text-[13px] font-semibold">{price === null ? <span className="text-danger">No {tier} price</span> : money(price)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Bill */}
        <aside aria-label="Current order" className="lg:sticky lg:top-4 lg:self-start">
          <div className="flex flex-col rounded-xl border border-line bg-surface lg:max-h-[calc(100vh-6rem)]">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="text-[15px] font-semibold">
                Order {tier === "wholesale" && <Badge tone="accent">Wholesale</Badge>}
              </h2>
              {cart.length > 0 && (
                <button type="button" className="text-[13px] font-semibold text-muted hover:text-danger" onClick={() => setCart([])}>
                  Clear
                </button>
              )}
            </div>
            <div className="space-y-3 px-4 py-3">
              <Segmented
                label="Order type"
                value={type}
                onChange={(v) => setType(v)}
                items={[
                  { value: "dine_in", label: "Dine-in" },
                  { value: "takeaway", label: "Takeaway" },
                ]}
              />
              {type === "dine_in" && (
                <Field label="Table" htmlFor="pos-table" error={err?.fields?.table_id}>
                  <Select id="pos-table" value={tableId} onChange={(e) => setTableId(e.target.value)} invalid={!!err?.fields?.table_id}>
                    <option value="">Choose table</option>
                    {data.tables.map((t) => (
                      <option key={t.id} value={t.id}>
                        Table {t.label}
                        {t.area ? ` · ${t.area}` : ""}
                        {t.occupied ? " (occupied — adds to bill)" : ""}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
            </div>
            <ul className="min-h-[96px] flex-1 divide-y divide-line overflow-y-auto border-t border-line">
              {!priced.length && (
                <li className="px-4 py-8 text-center text-[14px] text-muted">
                  <ShoppingBag size={20} className="mx-auto mb-2" aria-hidden />
                  Tap items to add them.
                </li>
              )}
              {priced.map((p) => (
                <li key={p.line.key} className="px-4 py-2.5">
                  <div className="flex items-start gap-2">
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => p.line.kind === "menu" && setConfig({ itemId: p.line.id, line: p.line })}
                      disabled={p.line.kind !== "menu"}
                    >
                      <span className="block text-[14px] font-semibold leading-snug">{p.title}</span>
                      {p.detail && <span className="block text-[12.5px] text-muted">{p.detail}</span>}
                      {p.line.notes && <span className="block text-[12.5px] italic text-muted">“{p.line.notes}”</span>}
                      {p.error && <span className="block text-[12.5px] font-semibold text-danger">{p.error}</span>}
                    </button>
                    <span className="num text-[14px] font-semibold">{money(p.total)}</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-1">
                    <button type="button" aria-label="One less" onClick={() => setQty(p.line.key, p.line.qty - 1)} className="grid h-8 w-8 place-items-center rounded-lg border border-line hover:bg-surface-2">
                      {p.line.qty === 1 ? <Trash2 size={14} /> : <Minus size={14} />}
                    </button>
                    <input
                      aria-label="Quantity"
                      inputMode="numeric"
                      className="num h-8 w-12 rounded-lg border border-line bg-bg text-center text-[14px]"
                      value={p.line.qty}
                      onChange={(e) => setQty(p.line.key, Math.max(0, Math.floor(Number(e.target.value.replace(/\D/g, "")) || 0)))}
                    />
                    <button type="button" aria-label="One more" onClick={() => setQty(p.line.key, p.line.qty + 1)} className="grid h-8 w-8 place-items-center rounded-lg border border-line hover:bg-surface-2">
                      <Plus size={14} />
                    </button>
                    <span className="ml-auto text-[12px] text-muted num">{money(p.unit)} each</span>
                  </div>
                </li>
              ))}
            </ul>
            <details className="group border-t border-line" open={!!(name || phone || notes || discount) || undefined}>
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-2.5 text-[13.5px] font-semibold">
                <span>
                  Customer, note{canDiscount ? " & discount" : ""}
                  {(name || phone) && <span className="ml-1 font-normal text-muted">· {name || phone}</span>}
                </span>
                <Plus size={15} className="text-muted transition-transform group-open:rotate-45" aria-hidden />
              </summary>
            <div className="space-y-3 px-4 pb-3">
              <div className="grid grid-cols-2 gap-2">
                <Field label="Customer name" htmlFor="pos-name" optional>
                  <Input id="pos-name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
                </Field>
                <Field label="Mobile" htmlFor="pos-phone" optional error={err?.fields?.customer_phone} hint="Earns loyalty points">
                  <Input id="pos-phone" inputMode="numeric" value={phone} maxLength={10} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} invalid={!!err?.fields?.customer_phone} />
                </Field>
              </div>
              <Field label="Note for kitchen" htmlFor="pos-notes" optional>
                <Textarea id="pos-notes" rows={1} value={notes} maxLength={200} onChange={(e) => setNotes(e.target.value)} />
              </Field>
              {canDiscount && (
                <Field label="Discount" htmlFor="pos-disc" optional>
                  <Input id="pos-disc" prefix="₹" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value.replace(/[^\d.]/g, ""))} />
                </Field>
              )}
            </div>
            </details>
            {totals && (
              <dl className="space-y-1 border-t border-line px-4 py-3 text-[14px]">
                <Row k="Subtotal" v={money(totals.subtotal)} />
                {totals.discount > 0 && <Row k="Discount" v={`− ${money(totals.discount)}`} />}
                {totals.service_charge > 0 && <Row k={`Service charge (${data.tax.service_charge_percent}%)`} v={money(totals.service_charge)} />}
                {totals.tax > 0 && <Row k={`GST (${data.tax.gst_percent}%)`} v={money(totals.tax)} />}
                <div className="flex justify-between pt-1 text-[17px] font-bold">
                  <dt>Total</dt>
                  <dd className="num">{money(totals.total)}</dd>
                </div>
              </dl>
            )}
            <div className="border-t border-line p-4">
              {err && !err.fields && <Notice tone="danger" className="mb-3">{err.message}</Notice>}
              <Button size="lg" className="w-full" onClick={submit} loading={busy} disabled={!cart.length || !!blocking || (type === "dine_in" && !tableId)}>
                {type === "dine_in" && !tableId && cart.length ? "Choose a table" : `Place order${totals ? ` · ${money(totals.total)}` : ""}`}
              </Button>
              <p className="mt-2 text-center text-[12px] text-muted">Payment is taken from the order once it’s placed.</p>
            </div>
          </div>
        </aside>
      </div>

      {config && (
        <Configurator
          menu={data}
          itemId={config.itemId}
          line={config.line}
          onClose={() => setConfig(null)}
          onSave={(l) => {
            if (config.line) setCart((c) => c.map((x) => (x.key === config.line!.key ? { ...l, key: x.key } : x)));
            else pushLine(l);
            setConfig(null);
          }}
        />
      )}
    </>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between text-muted">
      <dt>{k}</dt>
      <dd className="num text-fg">{v}</dd>
    </div>
  );
}

function Configurator({ menu, itemId, line, onClose, onSave }: { menu: PosMenu; itemId: string; line?: CartLine; onClose: () => void; onSave: (l: CartLine) => void }) {
  const item = menu.items.find((i) => i.id === itemId)!;
  const groups = item.group_ids.map((id) => menu.groups.find((g) => g.id === id)).filter((g): g is PosMenu["groups"][number] => !!g);
  const [variant, setVariant] = useState<string | null>(line?.variant_id ?? item.variants.find((v) => v.is_default)?.id ?? item.variants[0]?.id ?? null);
  const [mods, setMods] = useState<Set<string>>(() => {
    if (line) return new Set(line.modifier_ids);
    // Start from the recipe: included multi-select options ticked, single-select defaults chosen.
    return new Set(item.default_modifier_ids.filter((id) => groups.some((g) => g.modifiers.some((m) => m.id === id))));
  });
  const [qty, setQty] = useState(line?.qty ?? 1);
  const [notes, setNotes] = useState(line?.notes ?? "");
  const p = priceLine(menu, { item_id: item.id, variant_id: variant, modifier_ids: [...mods], qty });

  const toggle = (g: PosMenu["groups"][number], id: string) => {
    setMods((s) => {
      const n = new Set(s);
      if (g.selection === "single") {
        for (const m of g.modifiers) n.delete(m.id);
        n.add(id);
      } else if (n.has(id)) n.delete(id);
      else {
        if (g.max_select !== null && g.modifiers.filter((m) => n.has(m.id)).length >= g.max_select) return s;
        n.add(id);
      }
      return n;
    });
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={item.name}
      description={item.description}
      side
      footer={
        <>
          <div className="mr-auto flex items-center gap-1">
            <button type="button" aria-label="One less" onClick={() => setQty((q) => Math.max(1, q - 1))} className="grid h-10 w-10 place-items-center rounded-lg border border-line">
              <Minus size={16} />
            </button>
            <span className="num w-8 text-center font-semibold">{qty}</span>
            <button type="button" aria-label="One more" onClick={() => setQty((q) => Math.min(50, q + 1))} className="grid h-10 w-10 place-items-center rounded-lg border border-line">
              <Plus size={16} />
            </button>
          </div>
          <Button disabled={!p.ok} onClick={() => onSave({ key: line?.key ?? uid(), kind: "menu", id: item.id, variant_id: variant, modifier_ids: [...mods], qty, notes: notes.trim() || undefined })}>
            {line ? "Update" : "Add"} · {p.ok ? money(p.lineTotal) : "—"}
          </Button>
        </>
      }
    >
      {!p.ok && <Notice tone="warning" className="mb-3">{p.error}</Notice>}
      {item.variants.length > 1 && (
        <fieldset className="mb-5">
          <legend className="mb-2 text-[14px] font-semibold">Size</legend>
          <div className="grid grid-cols-2 gap-2">
            {item.variants.map((v) => (
              <Choice key={v.id} on={variant === v.id} onClick={() => setVariant(v.id)} label={v.name} price={money(v.price)} />
            ))}
          </div>
        </fieldset>
      )}
      {groups.map((g) => {
        const count = g.modifiers.filter((m) => mods.has(m.id)).length;
        return (
          <fieldset key={g.id} className="mb-5">
            <legend className="mb-2 flex w-full items-baseline justify-between text-[14px] font-semibold">
              <span>{g.name.replace(/^.*— /, "")}</span>
              <span className="text-[12px] font-normal text-muted">
                {g.selection === "single" ? "Choose one" : g.max_select ? `Up to ${g.max_select}${count ? ` · ${count} chosen` : ""}` : count ? `${count} chosen` : "Optional"}
              </span>
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {g.modifiers.map((m) => {
                const included = item.default_modifier_ids.includes(m.id);
                const def = g.modifiers.find((x) => item.default_modifier_ids.includes(x.id));
                const delta = g.selection === "single" ? Math.max(0, m.price - (def?.price ?? 0)) : included ? 0 : m.price;
                return <Choice key={m.id} on={mods.has(m.id)} onClick={() => toggle(g, m.id)} label={m.name} price={included && g.selection === "multi" ? "Included" : delta ? `+ ${money(delta)}` : ""} />;
              })}
            </div>
          </fieldset>
        );
      })}
      <Field label="Note" htmlFor="cfg-note" optional>
        <Input id="cfg-note" value={notes} maxLength={140} placeholder="Less ice, extra hot…" onChange={(e) => setNotes(e.target.value)} />
      </Field>
    </Dialog>
  );
}

function Choice({ on, onClick, label, price }: { on: boolean; onClick: () => void; label: string; price: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={clsx("flex min-h-[48px] items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-[13.5px] transition-colors", on ? "border-primary bg-primary-soft font-semibold" : "border-line hover:border-line-strong")}
    >
      <span>{label}</span>
      {price && <span className="num shrink-0 text-[12px] text-muted">{price}</span>}
    </button>
  );
}
