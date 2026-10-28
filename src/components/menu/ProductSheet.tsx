"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Heart, SlidersHorizontal, Sparkles } from "lucide-react";
import { Sheet } from "../ui/Sheet";
import { Amount, DietMark, QtyStepper } from "../ui/bits";
import { ItemVisual } from "../food/ItemVisual";
import { categoryById, MENU_BY_ID, TAG_LABEL, type MenuItem } from "@/data/menu";
import { builderKindFor, recipeFor } from "@/data/builders";
import { NOTES_MAX, SIMPLE_GROUPS } from "@/data/config";
import { useUI } from "@/store/ui";
import { useApp } from "@/store/app";
import { addToCart, builderLine, defaultChoices, simpleLine } from "@/lib/cart";
import { clsx } from "@/lib/clsx";

/** Product detail as a sheet/modal: options, notes, quantity, add. */
export function ProductSheet() {
  const id = useUI((s) => s.product);
  const close = useUI((s) => s.closeProduct);
  // keep the last item rendered while the sheet animates closed
  const last = useRef<MenuItem | null>(null);
  if (id && MENU_BY_ID[id]) last.current = MENU_BY_ID[id];
  const item = last.current;
  const isOpen = !!id;
  const router = useRouter();
  const favs = useApp((s) => s.favourites);
  const toggleFav = useApp((s) => s.toggleFavourite);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [qty, setQty] = useState(1);
  const addBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (id && MENU_BY_ID[id]) {
      setChoices(defaultChoices(MENU_BY_ID[id]));
      setNotes("");
      setQty(1);
    }
  }, [id]);

  if (!item) return null;
  const builder = item.customizer === "oats-builder" || item.customizer === "shake-builder";
  const groups = builder ? [] : SIMPLE_GROUPS[item.customizer as keyof typeof SIMPLE_GROUPS];
  const cat = categoryById(item.category);
  const fav = favs.includes(item.id);

  return (
    <Sheet
      open={isOpen}
      onClose={close}
      footer={
        builder ? (
          <div className="flex gap-3">
            <button className="btn-ghost h-14 flex-1" onClick={() => {
              const kind = builderKindFor(item)!;
              addToCart(builderLine(item, kind, recipeFor(kind, item.id), "", 1), addBtn.current, item.tint[0]);
              close();
            }} ref={addBtn}>
              Add as is
            </button>
            <button className="btn-primary h-14 flex-[1.4]" onClick={() => { close(); router.push(`/build/${item.id}`); }}>
              <SlidersHorizontal size={17} /> Customise
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <QtyStepper value={qty} min={1} onChange={setQty} label={item.name} />
            <button
              ref={addBtn}
              className="btn-primary h-14 flex-1 justify-between px-6"
              onClick={() => {
                addToCart(simpleLine(item, choices, notes, qty), addBtn.current, item.tint[0]);
                close();
              }}
            >
              <span>Add to cart</span>
              <Amount value={item.price * qty} />
            </button>
          </div>
        )
      }
    >
      <div className="md:grid md:grid-cols-[1fr_1.05fr] md:gap-6 md:p-7">
        <div className="relative mx-5 mt-1 aspect-[4/3] overflow-hidden rounded-3xl bg-[radial-gradient(circle_at_50%_40%,#fffaf0,#efe3c9)] md:mx-0 md:mt-0 md:aspect-square">
          <ItemVisual item={item} animate className="absolute inset-0 p-6" />
          <button
            onClick={() => toggleFav(item.id)}
            aria-pressed={fav}
            aria-label={fav ? "Remove from favourites" : "Save to favourites"}
            className="absolute right-3 top-3 grid h-11 w-11 place-items-center rounded-full bg-white/85 text-navy-800 shadow-card"
          >
            <Heart size={19} className={fav ? "fill-nonveg text-nonveg" : ""} />
          </button>
        </div>
        <div className="px-5 pb-5 pt-4 md:px-0 md:pb-0 md:pt-2">
          <p className="eyebrow">{cat.name}</p>
          <div className="mt-2 flex items-start gap-2.5">
            <DietMark diet={item.diet} className="mt-2" />
            <h2 className="font-display text-[32px] font-semibold leading-[1.05] text-navy-900">{item.name}</h2>
          </div>
          <p className="mt-2 font-display text-[28px] font-semibold text-navy-900">₹{item.price}</p>
          {item.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {item.tags.map((t) => (
                <span key={t} className="rounded-full bg-gold-200/70 px-2.5 py-1 text-[12px] font-semibold text-gold-700">
                  {TAG_LABEL[t]}
                </span>
              ))}
            </div>
          )}
          <p className="mt-3 text-[15.5px] leading-relaxed text-ink-soft">{item.description}</p>
          {cat.blurb && <p className="mt-2 text-[13.5px] italic text-gold-700">{cat.blurb}</p>}

          {builder && (
            <p className="mt-4 flex items-start gap-2 rounded-2xl bg-cream px-4 py-3 text-[14px] text-ink-soft">
              <Sparkles size={17} className="mt-0.5 shrink-0 text-gold-600" />
              Watch it come together — pick every ingredient and see it drop in live.
            </p>
          )}

          {groups.map((g) => (
            <fieldset key={g.id} className="mt-5">
              <legend className="mb-2 text-[14px] font-bold text-navy-900">{g.label}</legend>
              <div className="flex flex-wrap gap-2">
                {g.options.map((o) => {
                  const on = (choices[g.id] ?? g.options[g.defaultIndex]) === o;
                  return (
                    <label key={o} className={clsx("chip cursor-pointer", on ? "border-navy-800 bg-navy-800 text-ivory" : "border-sand-400 bg-white/70 text-navy-800 hover:border-gold-500")}>
                      <input type="radio" name={g.id} value={o} checked={on} onChange={() => setChoices((c) => ({ ...c, [g.id]: o }))} className="sr-only" />
                      {o}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ))}

          {!builder && (
            <div className="mt-5">
              <label htmlFor="notes" className="mb-2 block text-[14px] font-bold text-navy-900">
                Special instructions <span className="font-normal text-ink-muted">(optional)</span>
              </label>
              <textarea
                id="notes"
                value={notes}
                maxLength={NOTES_MAX}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="e.g. less spicy, no onion"
                className="w-full resize-none rounded-2xl border border-sand-400 bg-white/80 px-4 py-3 text-[15px] outline-none focus:border-gold-500"
              />
              <p className="mt-1 text-right text-[12px] text-ink-muted">
                {notes.length}/{NOTES_MAX}
              </p>
            </div>
          )}
        </div>
      </div>
    </Sheet>
  );
}
