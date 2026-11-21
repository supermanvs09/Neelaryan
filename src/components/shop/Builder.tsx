"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { OATS_STEPS } from "@/data/builders";
import { visualKeys, type ShopItem, type ShopMenu } from "@/lib/shop/menu";
import { useShop, type CartLine } from "@/lib/shop/store";
import { Choice } from "./ItemSheet";
import { groupTitle, optionDelta, useSelection } from "./selection";
import { DietMark, ShopButton, Stepper, rupee, toast } from "./ui";
import { useT } from "@/lib/shop/i18n";

const NUTRITION = new Map(OATS_STEPS.flatMap((s) => s.groups.flatMap((g) => g.options.map((o) => [o.id as string, o.nutrition] as const))));

/**
 * Build-your-own bowls and shakes as a plain form: one section per option group
 * (choices, prices and limits come from the menu), with a summary beside it.
 */
export function Builder({ menu, item, edit }: { menu: ShopMenu; item: ShopItem; edit: CartLine | null }) {
  const router = useRouter();
  const sel = useSelection(menu, item, edit ? { variant_id: edit.variant_id, modifier_ids: edit.modifier_ids } : undefined);
  const [qty, setQty] = useState(edit?.qty ?? 1);
  const [notes, setNotes] = useState(edit?.notes ?? "");
  const add = useShop((s) => s.add);
  const replace = useShop((s) => s.replace);
  const t = useT();
  const p = sel.price(qty);
  const soldOut = item.status !== "available";

  const nutrition = useMemo(() => {
    if (item.visual !== "bowl") return null;
    const t = visualKeys(menu, item, sel.mods).reduce(
      (a, k) => {
        const n = NUTRITION.get(k);
        return n ? { kcal: a.kcal + n.kcal, protein: a.protein + n.protein, fibre: a.fibre + n.fibre } : a;
      },
      { kcal: 0, protein: 0, fibre: 0 },
    );
    return t.kcal ? { kcal: Math.round(t.kcal / 5) * 5, protein: Math.round(t.protein), fibre: Math.round(t.fibre) } : null;
  }, [menu, item, sel.mods]);

  const done = () => {
    if (!p.ok) return;
    const line = { item_id: item.id, variant_id: sel.variant, modifier_ids: sel.mods, qty, notes: notes.trim() || undefined };
    if (edit) replace(edit.key, line);
    else add(line);
    toast(edit ? t("item.updated") : t("item.added", { qty, name: item.name }));
    router.push("/menu");
  };

  const action = (
    <ShopButton className="flex-1" onClick={done} disabled={!p.ok || soldOut}>
      {soldOut ? t("item.soldOutNow") : p.ok ? t(edit ? "build.updateOrder" : "build.addOrder", { price: rupee(p.lineTotal) }) : p.error}
    </ShopButton>
  );

  return (
    <div>
      <Link href="/menu" className="inline-flex h-10 items-center gap-1.5 pr-3 text-[14px] font-semibold text-muted hover:text-fg">
        <ArrowLeft size={17} aria-hidden /> {t("nav.menu")}
      </Link>
      <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-[26px] font-bold">
            <DietMark diet={item.diet} />
            {item.name}
          </h1>
          <p className="mt-0.5 text-[14.5px] text-muted">{item.description}</p>
        </div>
        <ShopButton variant="ghost" className="min-h-[40px] px-3 text-[14px]" onClick={sel.reset}>
          <RotateCcw size={15} /> {t("build.reset")}
        </ShopButton>
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          {sel.groups.map((g) => {
            const count = g.modifiers.filter((m) => sel.mods.includes(m.id)).length;
            return (
              <fieldset key={g.id} className="rounded-xl border border-line bg-surface p-4">
                <legend className="sr-only">{groupTitle(g)}</legend>
                <div className="mb-3 flex items-baseline justify-between gap-3">
                  <h2 className="text-[16px] font-bold">{groupTitle(g)}</h2>
                  <span className="text-[13px] text-muted">{g.selection === "single" ? t("item.chooseOne") : g.max_select ? `${t("item.upTo", { n: g.max_select })} · ${t("item.chosen", { n: count })}` : t("item.optional")}</span>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {g.modifiers.map((m) => {
                    const d = optionDelta(item, g, m.id);
                    const incl = g.selection === "multi" && item.default_modifier_ids.includes(m.id);
                    return <Choice key={m.id} on={sel.mods.includes(m.id)} label={m.name} price={incl ? t("item.included") : d ? `+${rupee(d)}` : ""} radio={g.selection === "single"} onClick={() => sel.toggle(g, m.id)} />;
                  })}
                </div>
              </fieldset>
            );
          })}
          {sel.limitHit && <p className="rounded-lg bg-warning-soft px-3 py-2 text-[13.5px] text-warning">{sel.limitHit}</p>}
          <label className="block rounded-xl border border-line bg-surface p-4">
            <span className="mb-1.5 block text-[16px] font-bold">
              {t("build.noteTitle")} <span className="text-[14px] font-normal text-muted">{t("item.optionalTag")}</span>
            </span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={140} rows={2} className="field-input w-full resize-none" placeholder={t("build.notePh")} />
          </label>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <section className="rounded-xl border border-line bg-surface">
            <h2 className="border-b border-line px-4 py-3 text-[15px] font-bold">{t("build.summary")}</h2>
            <dl className="divide-y divide-line text-[14px]">
              {sel.groups.map((g) => {
                const chosen = g.modifiers.filter((m) => sel.mods.includes(m.id));
                return (
                  <div key={g.id} className="flex justify-between gap-3 px-4 py-2.5">
                    <dt className="text-muted">{groupTitle(g)}</dt>
                    <dd className="text-right font-semibold">{chosen.length ? chosen.map((c) => c.name).join(", ") : <span className="font-normal text-muted">{t("build.none")}</span>}</dd>
                  </div>
                );
              })}
            </dl>
            {nutrition && (
              <p className="border-t border-line px-4 py-2.5 text-[13px] text-muted">
                {t("build.nutrition", { kcal: nutrition.kcal, protein: nutrition.protein, fibre: nutrition.fibre })}
              </p>
            )}
            <div className="hidden items-center gap-2 border-t border-line p-4 lg:flex">
              <Stepper value={qty} onChange={(v) => setQty(Math.max(1, v))} min={1} max={50} label="quantity" size="sm" />
              {action}
            </div>
          </section>
        </aside>
      </div>

      <div className="sticky bottom-0 -mx-4 mt-6 flex items-center gap-2 border-t border-line bg-bg px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] lg:hidden">
        <Stepper value={qty} onChange={(v) => setQty(Math.max(1, v))} min={1} max={50} label="quantity" size="sm" />
        {action}
      </div>
    </div>
  );
}
