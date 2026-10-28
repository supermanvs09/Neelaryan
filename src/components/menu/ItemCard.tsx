"use client";

import { useRouter } from "next/navigation";
import { useRef } from "react";
import { Plus, SlidersHorizontal } from "lucide-react";
import { Tilt } from "../ui/Tilt";
import { DietMark } from "../ui/bits";
import { ItemVisual } from "../food/ItemVisual";
import { TAG_LABEL, type MenuItem } from "@/data/menu";
import { useUI } from "@/store/ui";
import { addToCart, defaultChoices, simpleLine } from "@/lib/cart";
import { rupees } from "@/lib/format";
import { clsx } from "@/lib/clsx";

const isBuilder = (m: MenuItem) => m.customizer === "oats-builder" || m.customizer === "shake-builder";

/** Phones: compact row (picture left). Tablet/desktop: a tilting card. */
export function ItemCard({ item, layout = "auto" }: { item: MenuItem; layout?: "auto" | "card" }) {
  const router = useRouter();
  const open = useUI((s) => s.openProduct);
  const addBtn = useRef<HTMLButtonElement>(null);
  const unavailable = item.availability !== "available";
  const badge = item.tags.find((t) => t === "bestseller" || t === "new" || t === "recommended");

  const onAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isBuilder(item)) return router.push(`/build/${item.id}`);
    addToCart(simpleLine(item, defaultChoices(item), "", 1), addBtn.current, item.tint[0]);
  };

  const add = (
    <button
      ref={addBtn}
      onClick={onAdd}
      disabled={unavailable}
      className={clsx(
        "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-[14px] font-bold shadow-sm transition-[transform,background-color] active:scale-95",
        isBuilder(item) ? "bg-navy-800 text-ivory hover:bg-navy-700" : "border border-gold-500 bg-white text-navy-900 hover:bg-gold-200",
      )}
      aria-label={isBuilder(item) ? `Customise ${item.name}` : `Add ${item.name} to cart`}
    >
      {isBuilder(item) ? <SlidersHorizontal size={15} /> : <Plus size={16} />}
      {isBuilder(item) ? "Customise" : "Add"}
    </button>
  );

  return (
    <Tilt as="article" max={6} className={clsx("rounded-3xl", layout === "card" && "h-full")}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => open(item.id)}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), open(item.id))}
        aria-label={`${item.name}, ${rupees(item.price)}. View details`}
        className={clsx(
          "group/card card flex h-full cursor-pointer overflow-hidden transition-shadow hover:shadow-lift",
          layout === "card" ? "flex-col" : "flex-row md:flex-col",
          unavailable && "opacity-60",
        )}
      >
        <div
          className={clsx(
            "relative shrink-0 bg-[radial-gradient(circle_at_50%_40%,#fffaf0,#f1e6cf)]",
            layout === "card" ? "aspect-[4/3] w-full" : "h-[118px] w-[118px] md:aspect-[4/3] md:h-auto md:w-full",
          )}
        >
          <ItemVisual item={item} className="absolute inset-0 p-2 [transform:translateZ(30px)] md:p-4" />
          {badge && (
            <span className="absolute left-2 top-2 rounded-full bg-navy-800/90 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-gold-200 md:left-3 md:top-3">
              {TAG_LABEL[badge]}
            </span>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-between gap-2 p-3.5 md:p-4">
          <div>
            <div className="flex items-start gap-2">
              <DietMark diet={item.diet} className="mt-1" />
              <h3 className="font-semibold leading-snug text-navy-900">{item.name}</h3>
            </div>
            <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-ink-muted">{item.description}</p>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[17px] font-bold tabular-nums text-navy-900">{rupees(item.price)}</span>
            {unavailable ? <span className="text-[13px] font-semibold text-nonveg">Sold out</span> : add}
          </div>
        </div>
      </div>
    </Tilt>
  );
}
