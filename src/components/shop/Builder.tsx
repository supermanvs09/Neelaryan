"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, RotateCcw } from "lucide-react";
import { OATS_STEPS, type IngredientId } from "@/data/builders";
import { OptionThumb } from "@/components/builder/OptionThumb";
import { visualKeys, type ShopItem, type ShopMenu } from "@/lib/shop/menu";
import { useShop, type CartLine } from "@/lib/shop/store";
import { ItemVisual } from "./ItemVisual";
import { groupTitle, optionDelta, useSelection } from "./selection";
import { DietMark, ShopButton, Stepper, rupee, toast } from "./ui";
import { clsx } from "@/lib/clsx";

const NUTRITION = new Map(OATS_STEPS.flatMap((s) => s.groups.flatMap((g) => g.options.map((o) => [o.id as string, o.nutrition] as const))));
const THUMBS = new Set(["regular-oats", "extra-oats", "oats-milk", "banana", "apple", "strawberry", "blueberry", "pomegranate", "kiwi", "mango", "peanut-butter", "almonds", "chia", "raisins", "pumpkin-seeds", "cocoa-nibs", "choco-sauce", "dry-fruits", "cinnamon", "no-protein", "plant-protein", "whey-protein", "honey", "granola", "icecream-scoop", "regular-milk", "almond-milk", "oat-milk", "coconut-milk", "choco-chips", "sweet-less", "sweet-regular", "sweet-extra", "ice-none", "ice-less", "ice-regular"]);

/**
 * Build-your-own bowls and shakes. Steps are the item's option groups from the menu
 * (so the owner controls choices, prices and limits); the picture is assembled from
 * the options' visual keys.
 */
export function Builder({ menu, item, edit }: { menu: ShopMenu; item: ShopItem; edit: CartLine | null }) {
  const router = useRouter();
  const sel = useSelection(menu, item, edit ? { variant_id: edit.variant_id, modifier_ids: edit.modifier_ids } : undefined);
  const [step, setStep] = useState(0);
  const [qty, setQty] = useState(edit?.qty ?? 1);
  const [notes, setNotes] = useState(edit?.notes ?? "");
  const add = useShop((s) => s.add);
  const replace = useShop((s) => s.replace);
  const steps = sel.groups;
  const review = step >= steps.length;
  const g = steps[step];
  const p = sel.price(qty);
  const keys = visualKeys(menu, item, sel.mods);
  const soldOut = item.status !== "available";

  const nutrition = useMemo(() => {
    if (item.visual !== "bowl") return null;
    const t = keys.reduce((a, k) => {
      const n = NUTRITION.get(k);
      return n ? { kcal: a.kcal + n.kcal, protein: a.protein + n.protein, fibre: a.fibre + n.fibre } : a;
    }, { kcal: 0, protein: 0, fibre: 0 });
    return t.kcal ? { kcal: Math.round(t.kcal / 5) * 5, protein: Math.round(t.protein), fibre: Math.round(t.fibre) } : null;
  }, [keys, item.visual]);

  const done = () => {
    if (!p.ok) return;
    const line = { item_id: item.id, variant_id: sel.variant, modifier_ids: sel.mods, qty, notes: notes.trim() || undefined };
    if (edit) replace(edit.key, line);
    else add(line);
    toast(edit ? "Updated" : `${qty} × ${item.name} added`);
    router.push("/menu");
  };

  const summary = steps.map((gr) => ({ g: gr, chosen: gr.modifiers.filter((m) => sel.mods.includes(m.id)) }));

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-10">
      {/* the dish */}
      <div className="lg:sticky lg:top-24 lg:self-start">
        <Link href="/menu" className="inline-flex h-10 items-center gap-1.5 rounded-full pr-3 text-[14px] font-semibold text-muted hover:text-fg">
          <ArrowLeft size={17} aria-hidden /> Menu
        </Link>
        <div className="mx-auto mt-1 aspect-square w-full max-w-[460px] rounded-[32px] bg-surface-2">
          <ItemVisual item={item} keys={keys} animate className="h-full w-full" />
        </div>
        <div className="mx-auto mt-4 max-w-[460px]">
          <h1 className="flex items-start gap-2 font-display text-[30px] font-semibold leading-tight md:text-[36px]">
            <DietMark diet={item.diet} className="mt-3" />
            {item.name}
          </h1>
          <p className="mt-1 text-[14.5px] text-muted">{item.description}</p>
          {nutrition && (
            <p className="mt-3 text-[13px] text-muted">
              About <b className="num text-fg">{nutrition.kcal} kcal</b> · <b className="num text-fg">{nutrition.protein} g</b> protein · <b className="num text-fg">{nutrition.fibre} g</b> fibre <span className="opacity-75">(estimated)</span>
            </p>
          )}
        </div>
      </div>

      {/* the choices */}
      <div className="min-w-0">
        <ol className="mb-5 flex gap-1.5" aria-label="Steps">
          {[...steps.map((s) => groupTitle(s)), "Review"].map((t, i) => (
            <li key={t + i} className="flex-1">
              <button type="button" onClick={() => setStep(i)} className="w-full text-left" aria-current={i === step ? "step" : undefined}>
                <span className={clsx("block h-1.5 rounded-full", i < step ? "bg-primary" : i === step ? "bg-accent" : "bg-line")} />
                <span className={clsx("mt-1.5 hidden truncate text-[12px] font-semibold sm:block", i === step ? "text-fg" : "text-muted")}>{t}</span>
              </button>
            </li>
          ))}
        </ol>

        {!review && g ? (
          <section aria-labelledby="step-h">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="step-h" className="text-[22px] font-bold">
                {groupTitle(g)}
              </h2>
              <span className="text-[13px] text-muted">
                {g.selection === "single" ? "Choose one" : g.max_select ? `Up to ${g.max_select} · ${g.modifiers.filter((m) => sel.mods.includes(m.id)).length} chosen` : "Choose any"}
              </span>
            </div>
            {g.description && <p className="mt-0.5 text-[14px] text-muted">{g.description}</p>}
            <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {g.modifiers.map((m) => {
                const on = sel.mods.includes(m.id);
                const d = optionDelta(item, g, m.id);
                const incl = g.selection === "multi" && item.default_modifier_ids.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    role={g.selection === "single" ? "radio" : "checkbox"}
                    aria-checked={on}
                    onClick={() => sel.toggle(g, m.id)}
                    className={clsx("relative flex flex-col items-center rounded-2xl border p-3 text-center transition-colors", on ? "border-primary bg-primary-soft" : "border-line bg-surface hover:border-line-strong")}
                  >
                    {on && (
                      <span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-fg" aria-hidden>
                        <Check size={12} strokeWidth={3} />
                      </span>
                    )}
                    <span className="h-14 w-14">{m.visual_key && THUMBS.has(m.visual_key) ? <OptionThumb id={m.visual_key as IngredientId} /> : null}</span>
                    <span className="mt-1.5 text-[14px] font-semibold leading-tight">{m.name}</span>
                    <span className="num mt-0.5 text-[12.5px] text-muted">{incl ? "Included" : d ? `+${rupee(d)}` : "Free"}</span>
                  </button>
                );
              })}
            </div>
            {sel.limitHit && <p className="mt-3 rounded-xl bg-warning-soft px-3 py-2 text-[13.5px] text-warning">{sel.limitHit}</p>}
          </section>
        ) : (
          <section aria-labelledby="rev-h">
            <h2 id="rev-h" className="text-[22px] font-bold">
              Your {item.visual === "bowl" ? "bowl" : "shake"}
            </h2>
            <dl className="mt-3 divide-y divide-line rounded-2xl border border-line bg-surface">
              {summary.map(({ g: gr, chosen }, i) => (
                <div key={gr.id} className="flex items-start justify-between gap-3 px-4 py-3">
                  <dt className="text-[14px] text-muted">{groupTitle(gr)}</dt>
                  <dd className="flex items-start gap-2 text-right text-[14px] font-semibold">
                    {chosen.length ? chosen.map((c) => c.name).join(", ") : <span className="font-normal text-muted">None</span>}
                    <button type="button" className="text-[13px] font-semibold text-primary hover:underline" onClick={() => setStep(i)}>
                      Change
                    </button>
                  </dd>
                </div>
              ))}
            </dl>
            <label className="mt-4 block">
              <span className="mb-1.5 block text-[15px] font-bold">
                Note for the kitchen <span className="font-normal text-muted">(optional)</span>
              </span>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={140} rows={2} className="field-input w-full resize-none" placeholder="Less sweet, nut allergy…" />
            </label>
          </section>
        )}

        <div className="sticky bottom-0 -mx-4 mt-6 border-t border-line bg-bg/95 px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] md:static md:mx-0 md:border-0 md:bg-transparent md:px-0">
          <div className="flex items-center gap-2">
            {step > 0 ? (
              <ShopButton variant="secondary" onClick={() => setStep(step - 1)} aria-label="Previous step" className="px-4">
                <ArrowLeft size={18} />
              </ShopButton>
            ) : (
              <ShopButton variant="ghost" onClick={sel.reset} className="px-4" aria-label="Start over">
                <RotateCcw size={17} />
              </ShopButton>
            )}
            {review ? (
              <>
                <Stepper value={qty} onChange={(v) => setQty(Math.max(1, v))} min={1} max={50} label="quantity" />
                <ShopButton className="flex-1" onClick={done} disabled={!p.ok || soldOut}>
                  {soldOut ? "Sold out right now" : p.ok ? `${edit ? "Update" : "Add"} · ${rupee(p.lineTotal)}` : p.error}
                </ShopButton>
              </>
            ) : (
              <ShopButton className="flex-1" onClick={() => setStep(step + 1)}>
                {step === steps.length - 1 ? "Review" : "Next"} <span className="num opacity-80">· {p.ok ? rupee(p.unitPrice) : "—"}</span> <ArrowRight size={17} aria-hidden />
              </ShopButton>
            )}
          </div>
          {!review && (
            <button type="button" className="mt-2 w-full text-center text-[13.5px] font-semibold text-primary hover:underline" onClick={() => setStep(steps.length)}>
              Skip to review
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
