"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { ItemCard, MenuGate } from "@/components/shop/ItemCard";
import type { ShopMenu } from "@/lib/shop/menu";
import { clsx } from "@/lib/clsx";

export default function MenuPage() {
  return <MenuGate>{(menu) => <Menu menu={menu} />}</MenuGate>;
}

type Diet = "all" | "veg";

function Menu({ menu }: { menu: ShopMenu }) {
  const [q, setQ] = useState("");
  const [diet, setDiet] = useState<Diet>("all");
  const [active, setActive] = useState<string | null>(null);
  const rail = useRef<HTMLDivElement>(null);

  const sections = useMemo(() => {
    const s = q.trim().toLowerCase();
    return menu.categories
      .map((c) => ({
        c,
        items: menu.items.filter((i) => i.category_id === c.id && (diet === "all" || i.diet === "veg") && (!s || i.name.toLowerCase().includes(s) || i.description.toLowerCase().includes(s) || i.tags.some((t) => t.includes(s)))),
      }))
      .filter((x) => x.items.length);
  }, [menu, q, diet]);

  // highlight the category in view
  useEffect(() => {
    const els = sections.map((x) => document.getElementById(x.c.slug)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver((entries) => {
      const v = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (v) setActive(v.target.id);
    }, { rootMargin: "-140px 0px -60% 0px" });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [sections]);
  useEffect(() => {
    rail.current?.querySelector(`[data-cat="${active}"]`)?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [active]);
  // deep link /menu#category
  useEffect(() => {
    const h = decodeURIComponent(window.location.hash.slice(1));
    if (h) setTimeout(() => document.getElementById(h)?.scrollIntoView({ block: "start" }), 50);
  }, []);

  const total = sections.reduce((n, s) => n + s.items.length, 0);

  return (
    <div>
      <h1 className="sr-only">Menu</h1>
      <div className="sticky top-16 z-30 -mx-4 border-b border-line bg-bg/95 px-4 pb-2 pt-2 md:top-[72px] md:mx-0 md:px-0">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the menu" aria-label="Search the menu" className="field-input h-11 w-full pl-10 pr-10" />
            {q && (
              <button type="button" onClick={() => setQ("")} className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-surface-2" aria-label="Clear search">
                <X size={16} />
              </button>
            )}
          </div>
          <button type="button" aria-pressed={diet === "veg"} onClick={() => setDiet(diet === "veg" ? "all" : "veg")} className={clsx("flex h-11 shrink-0 items-center gap-2 rounded-lg border px-4 text-[14px] font-semibold", diet === "veg" ? "border-veg bg-veg/10 text-veg" : "border-line bg-surface")}>
            <span className="grid h-[14px] w-[14px] place-items-center rounded-[3px] border-[1.5px] border-veg">
              <span className="h-[6px] w-[6px] rounded-full bg-veg" />
            </span>
            Veg only
          </button>
        </div>
        <div ref={rail} className="no-scrollbar -mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:px-0" role="navigation" aria-label="Menu sections">
          {sections.map(({ c }) => (
            <a
              key={c.id}
              href={`#${c.slug}`}
              data-cat={c.slug}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(c.slug)?.scrollIntoView({ block: "start", behavior: "smooth" });
                history.replaceState(null, "", `#${c.slug}`);
              }}
              className={clsx("h-9 shrink-0 rounded-lg px-3.5 text-[13.5px] font-semibold leading-9 transition-colors", active === c.slug ? "bg-primary text-primary-fg" : "bg-surface text-fg hover:bg-surface-2")}
            >
              {c.name}
            </a>
          ))}
        </div>
      </div>

      {!total ? (
        <div className="py-20 text-center">
          <p className="text-[17px] font-semibold">Nothing matches “{q}”</p>
          <button type="button" onClick={() => (setQ(""), setDiet("all"))} className="mt-3 font-semibold text-primary hover:underline">
            Show everything
          </button>
        </div>
      ) : (
        sections.map(({ c, items }) => (
          <section key={c.id} id={c.slug} aria-labelledby={`h-${c.slug}`} className="scroll-mt-[150px] pt-6 md:scroll-mt-[160px]">
            <h2 id={`h-${c.slug}`} className="text-[21px] font-bold">
              {c.name}
            </h2>
            {c.description && <p className="mt-0.5 text-[14px] text-muted">{c.description}</p>}
            <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {items.map((i) => (
                <ItemCard key={i.id} menu={menu} item={i} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
