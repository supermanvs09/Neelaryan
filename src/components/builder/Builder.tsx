"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import { ArrowLeft, ArrowRight, Check, Flame, Dumbbell, Wheat, ShoppingBag, RotateCcw } from "lucide-react";
import type { MenuItem } from "@/data/menu";
import {
  describeSelection,
  estimateNutrition,
  extrasPrice,
  optionDelta,
  recipeFor,
  sanitizeSelection,
  SHAKE_GARNISH,
  stepsFor,
  type BuilderKind,
  type BuilderGroup,
  type IngredientId,
  type Selection,
} from "@/data/builders";
import { NOTES_MAX } from "@/data/config";
import { BowlScene } from "../food/BowlScene";
import { GlassScene } from "../food/GlassScene";
import { selectionIngredients } from "../food/ItemVisual";
import { Amount, DietMark, QtyStepper } from "../ui/bits";
import { OptionThumb } from "./OptionThumb";
import { useApp } from "@/store/app";
import { useUI } from "@/store/ui";
import { addToCart, builderLine } from "@/lib/cart";
import { clsx } from "@/lib/clsx";

/** The stage the dish is built on, tilting toward the pointer (CSS 3D). */
function Stage({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const ry = useSpring(useTransform(px, [-1, 1], [-8, 8]), { stiffness: 90, damping: 18 });
  const rx = useSpring(useTransform(py, [-1, 1], [6, -6]), { stiffness: 90, damping: 18 });
  return (
    <div
      className="relative [perspective:1000px]"
      onPointerMove={(e) => {
        if (reduced || e.pointerType !== "mouse") return;
        const r = e.currentTarget.getBoundingClientRect();
        px.set(((e.clientX - r.left) / r.width) * 2 - 1);
        py.set(((e.clientY - r.top) / r.height) * 2 - 1);
      }}
      onPointerLeave={() => {
        px.set(0);
        py.set(0);
      }}
    >
      <motion.div style={{ rotateX: rx, rotateY: ry }} className="[transform-style:preserve-3d]">
        {children}
      </motion.div>
    </div>
  );
}

export function Builder({ item, kind, editKey }: { item: MenuItem; kind: BuilderKind; editKey: string | null }) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const steps = stepsFor(kind);
  const recipe = useMemo(() => recipeFor(kind, item.id), [kind, item.id]);
  const cart = useApp((s) => s.cart);
  const editing = editKey ? cart.find((l) => l.key === editKey && l.builder?.kind === kind) : undefined;

  const [sel, setSel] = useState<Selection>(() => (editing?.builder ? sanitizeSelection(kind, recipe, editing.builder.selection) : recipe));
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [qty, setQty] = useState(editing?.qty ?? 1);
  const [step, setStep] = useState(0);
  const [hint, setHint] = useState<string | null>(null);
  const addBtn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const review = step === steps.length;

  // restore edit state once the cart has hydrated
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current || !editing?.builder) return;
    restored.current = true;
    setSel(sanitizeSelection(kind, recipe, editing.builder.selection));
    setNotes(editing.notes ?? "");
    setQty(editing.qty);
  }, [editing, kind, recipe]);

  const extras = extrasPrice(kind, recipe, sel);
  const unit = item.price + extras;
  const nutrition = estimateNutrition(kind, sel);
  const ingredients = selectionIngredients(sel);

  const toggle = (g: BuilderGroup, id: IngredientId) => {
    setHint(null);
    setSel((prev) => {
      const cur = prev[g.id] ?? [];
      if (g.mode === "single") return { ...prev, [g.id]: [id] };
      if (cur.includes(id)) return { ...prev, [g.id]: cur.filter((x) => x !== id) };
      if (g.max && cur.length >= g.max) {
        setHint(`You can pick up to ${g.max} ${g.label.toLowerCase()} — remove one to swap.`);
        return prev;
      }
      return { ...prev, [g.id]: [...cur, id] };
    });
  };

  const go = (n: number) => {
    setStep(Math.max(0, Math.min(steps.length, n)));
    setHint(null);
    panel.current?.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  };

  const save = () => {
    const line = builderLine(item, kind, sel, notes, qty);
    if (editing) {
      useApp.getState().replaceLine(editing.key, line);
      useUI.getState().showToast("Cart updated");
    } else {
      addToCart(line, addBtn.current, item.tint[0]);
    }
    router.push("/menu");
    if (editing) useUI.getState().openCart();
  };

  const stepLabels = [...steps.map((s) => s.groups[0].label), "Review"];

  return (
    <div className="pb-28 md:pb-8">
      <div className="mb-3 flex items-center gap-3">
        <Link href="/menu" className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-sand-400 bg-white/70 text-navy-800 hover:border-gold-500" aria-label="Back to menu">
          <ArrowLeft size={19} />
        </Link>
        <div className="min-w-0">
          <p className="eyebrow">{kind === "oats" ? "Customise your bowl" : "Customise your milkshake"}</p>
          <h1 className="flex items-start gap-2 font-display text-[26px] font-semibold leading-[1.05] text-navy-900 md:text-[34px]">
            <DietMark diet={item.diet} className="mt-2" /> {item.name}
          </h1>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr] lg:gap-10">
        {/* stage */}
        {/* phones: a compact sticky stage so every pick can be watched dropping in */}
        <div className="sticky top-16 z-20 -mx-4 min-w-0 bg-ivory/80 px-4 pb-2 backdrop-blur-md md:static md:mx-0 md:bg-transparent md:p-0 md:backdrop-blur-none lg:sticky lg:top-24 lg:self-start">
          <div className="relative overflow-hidden rounded-[28px] bg-[radial-gradient(ellipse_at_50%_35%,#fff8e8,#efe1c3_75%)] px-4 pb-3 pt-3 shadow-card md:rounded-[32px] md:px-10 md:pb-4 md:pt-6">
            <div aria-hidden className="absolute -right-10 -top-10 h-48 w-48 animate-sway rounded-full bg-[radial-gradient(circle,rgba(47,58,34,0.16),transparent_65%)] blur-xl" />
            <Stage>
              {kind === "oats" ? (
                <div className="mx-auto max-w-[min(64vw,300px)] md:max-w-none">
                <BowlScene ingredients={ingredients} introDelay={0.4} priority label={`${item.name}: ${describeSelection(kind, recipe, sel).map((d) => `${d.label} ${d.value}`).join(", ")}`} />
                </div>
              ) : (
                <div className="mx-auto max-w-[min(34vw,150px)] md:max-w-[340px]">
                  <GlassScene ingredients={ingredients} flavour={item.tint[0]} garnish={SHAKE_GARNISH[item.id] ?? "none"} label={item.name} />
                </div>
              )}
            </Stage>
            <div className="relative mt-1 flex flex-wrap items-center justify-between gap-2">
              {nutrition ? (
                <ul className="flex gap-2 text-[12.5px]" aria-label="Estimated nutrition">
                  <li className="flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-1 font-semibold text-navy-900">
                    <Flame size={14} className="text-gold-600" /> {nutrition.kcal} kcal
                  </li>
                  <li className="flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-1 font-semibold text-navy-900">
                    <Dumbbell size={14} className="text-gold-600" /> {nutrition.protein} g protein
                  </li>
                  <li className="hidden items-center gap-1 rounded-full bg-white/80 px-2.5 py-1 font-semibold text-navy-900 sm:flex">
                    <Wheat size={14} className="text-gold-600" /> {nutrition.fibre} g fibre
                  </li>
                </ul>
              ) : (
                <span />
              )}
              <span className="font-display text-[24px] font-semibold text-navy-900 md:text-[28px]">
                <Amount value={unit} />
              </span>
            </div>
            {nutrition && <p className="relative mt-1 hidden text-[11px] text-ink-muted md:block">Nutrition is an estimate for standard portions.</p>}
          </div>
        </div>

        {/* steps */}
        <div ref={panel} className="min-w-0">
          <nav aria-label="Steps" className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
            {stepLabels.map((l, i) => (
              <button
                key={l}
                onClick={() => go(i)}
                aria-current={i === step ? "step" : undefined}
                className={clsx(
                  "chip",
                  i === step ? "border-navy-800 bg-navy-800 text-ivory" : i < step ? "border-gold-500 bg-gold-200/60 text-navy-900" : "border-sand-400 bg-white/70 text-ink-soft",
                )}
              >
                {i < step && <Check size={14} />}
                {l}
              </button>
            ))}
          </nav>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-sand-400/50" aria-hidden>
            <motion.div className="h-full rounded-full bg-gradient-to-r from-gold-500 to-gold-400" animate={{ width: `${(step / steps.length) * 100}%` }} />
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={reduced ? { opacity: 0 } : { opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, x: -24 }}
              transition={{ duration: 0.22 }}
              className="mt-5"
            >
              {!review ? (
                <>
                  <h2 className="font-display text-[30px] font-semibold leading-tight text-navy-900">{steps[step].title}</h2>
                  <p className="text-[14px] text-ink-muted">Step {step + 1} of {steps.length + 1} · {steps[step].hint}</p>
                  {steps[step].groups.map((g) => (
                    <fieldset key={g.id} className="mt-4">
                      <legend className={clsx("mb-2 text-[14px] font-bold text-navy-900", steps[step].groups.length === 1 && "sr-only")}>{g.label}</legend>
                      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
                        {g.options.map((o) => {
                          const on = (sel[g.id] ?? []).includes(o.id);
                          const included = (recipe[g.id] ?? []).includes(o.id);
                          const delta = optionDelta(kind, recipe, g, o);
                          return (
                            <button
                              key={o.id}
                              type="button"
                              role={g.mode === "single" ? "radio" : "checkbox"}
                              aria-checked={on}
                              onClick={() => toggle(g, o.id)}
                              className={clsx(
                                "relative flex min-h-[124px] flex-col items-center rounded-2xl border p-2 pb-2.5 text-center transition-[border-color,background-color,transform] active:scale-[0.97]",
                                on ? "border-gold-500 bg-gold-200/50 shadow-gold" : "border-sand-400/80 bg-white/75 hover:border-gold-500",
                              )}
                            >
                              {on && (
                                <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-navy-800 text-ivory">
                                  <Check size={12} strokeWidth={3} />
                                </span>
                              )}
                              <span className="mb-1.5 grid h-14 w-14 place-items-center">
                                <OptionThumb id={o.id} />
                              </span>
                              <span className="text-[13px] font-semibold leading-tight text-navy-900">{o.label}</span>
                              <span className={clsx("mt-0.5 text-[12px] font-semibold", included ? "text-veg" : "text-gold-700")}>{included ? "Included" : delta > 0 ? `+ ₹${delta}` : "Free"}</span>
                            </button>
                          );
                        })}
                      </div>
                    </fieldset>
                  ))}
                  <p className="mt-3 min-h-[20px] text-[13px] font-medium text-nonveg" aria-live="polite">
                    {hint}
                  </p>
                </>
              ) : (
                <>
                  <h2 className="font-display text-[30px] font-semibold leading-tight text-navy-900">Your {kind === "oats" ? "bowl" : "milkshake"}</h2>
                  <dl className="mt-3 divide-y divide-sand-400/50 rounded-2xl border border-sand-400/60 bg-white/75">
                    {describeSelection(kind, recipe, sel).map((d) => (
                      <div key={d.label} className="flex items-start justify-between gap-4 px-4 py-3">
                        <dt className="text-[14px] text-ink-muted">{d.label}</dt>
                        <dd className="flex items-center gap-3 text-right text-[14.5px] font-semibold text-navy-900">
                          {d.value}
                          <button onClick={() => go(Math.max(0, steps.findIndex((st) => st.groups.some((g) => g.label === d.label))))} className="text-[13px] font-semibold text-gold-700 underline-offset-2 hover:underline">
                            Edit
                          </button>
                        </dd>
                      </div>
                    ))}
                  </dl>
                  {extras > 0 && (
                    <p className="mt-2 text-[13.5px] text-ink-soft">
                      ₹{item.price} {item.name} + ₹{extras} add-ons
                    </p>
                  )}
                  <label htmlFor="b-notes" className="mb-2 mt-5 block text-[14px] font-bold text-navy-900">
                    Special instructions <span className="font-normal text-ink-muted">(optional)</span>
                  </label>
                  <textarea
                    id="b-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    maxLength={NOTES_MAX}
                    rows={2}
                    placeholder="e.g. less sweet, no nuts"
                    className="w-full resize-none rounded-2xl border border-sand-400 bg-white/80 px-4 py-3 text-[15px] outline-none focus:border-gold-500"
                  />
                  <div className="mt-4 flex items-center justify-between">
                    <QtyStepper value={qty} min={1} onChange={setQty} label={item.name} />
                    <button onClick={() => setSel(recipe)} className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-ink-soft hover:text-navy-900">
                      <RotateCcw size={15} /> Reset to original
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>

          {/* actions — sticky on phones */}
          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-sand-400/60 bg-ivory/95 px-4 pb-[calc(env(safe-area-inset-bottom)+10px)] pt-3 backdrop-blur-md md:static md:mt-6 md:border-0 md:bg-transparent md:p-0">
            <div className="mx-auto flex max-w-[1320px] gap-3">
              {step > 0 && (
                <button onClick={() => go(step - 1)} className="btn-ghost h-14 px-5">
                  <ArrowLeft size={17} /> Back
                </button>
              )}
              {!review ? (
                <button onClick={() => go(step + 1)} className="btn-primary h-14 flex-1 justify-between px-6">
                  <span>Next: {stepLabels[step + 1]}</span>
                  <span className="flex items-center gap-2">
                    <Amount value={unit} /> <ArrowRight size={18} />
                  </span>
                </button>
              ) : (
                <button ref={addBtn} onClick={save} className="btn-gold h-14 flex-1 justify-between px-6 text-[16px]">
                  <span className="flex items-center gap-2">
                    <ShoppingBag size={18} /> {editing ? "Update cart" : "Add to cart"}
                  </span>
                  <Amount value={unit * qty} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
