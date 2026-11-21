"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { CATEGORIES, MENU, type CategoryId, type MenuItem } from "@/data/menu";
import { ItemCard } from "@/components/menu/ItemCard";
import { clsx } from "@/lib/clsx";

type FilterId = "veg" | "egg" | "nonveg" | "bestseller" | "healthy" | "protein" | "spicy" | "under100";

const FILTERS: { id: FilterId; label: string }[] = [
  { id: "veg", label: "Veg" },
  { id: "egg", label: "Egg" },
  { id: "nonveg", label: "Non-veg" },
  { id: "bestseller", label: "Bestseller" },
  { id: "healthy", label: "Healthy" },
  { id: "protein", label: "Protein rich" },
  { id: "spicy", label: "Spicy" },
  { id: "under100", label: "Under ₹100" },
];

function matches(m: MenuItem, q: string, filters: Set<FilterId>) {
  if (q) {
    const hay = `${m.name} ${m.description}`.toLowerCase();
    if (!q.split(/\s+/).every((w) => hay.includes(w))) return false;
  }
  const diets = (["veg", "egg", "nonveg"] as const).filter((d) => filters.has(d));
  if (diets.length && !diets.includes(m.diet as (typeof diets)[number])) return false;
  if (filters.has("bestseller") && !m.tags.includes("bestseller")) return false;
  if (filters.has("healthy") && !m.tags.includes("healthy")) return false;
  if (filters.has("protein") && !m.tags.includes("protein")) return false;
  if (filters.has("spicy") && !m.tags.includes("spicy")) return false;
  if (filters.has("under100") && m.price >= 100) return false;
  return m.availability !== "unavailable";
}

export default function MenuPage() {
  const reduced = useReducedMotion();
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Set<FilterId>>(new Set());
  const [active, setActive] = useState<CategoryId>(CATEGORIES[0].id);
  const tabs = useRef<HTMLDivElement>(null);
  const q = query.trim().toLowerCase();

  const sections = useMemo(
    () => CATEGORIES.map((c) => ({ cat: c, items: MENU.filter((m) => m.category === c.id && matches(m, q, filters)) })).filter((s) => s.items.length),
    [q, filters],
  );
  const count = sections.reduce((n, s) => n + s.items.length, 0);

  // scroll-spy: highlight the category in view
  useEffect(() => {
    const els = sections.map((s) => document.getElementById(s.cat.id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (vis) setActive(vis.target.id as CategoryId);
      },
      { rootMargin: "-170px 0px -60% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [sections]);

  // keep the active tab visible in the horizontal rail
  useEffect(() => {
    const btn = tabs.current?.querySelector<HTMLElement>(`[data-tab="${active}"]`);
    btn?.scrollIntoView({ block: "nearest", inline: "center", behavior: reduced ? "auto" : "smooth" });
  }, [active, reduced]);

  // deep links like /menu#oats-bowls
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id) return;
    const t = setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "auto" }), 60);
    return () => clearTimeout(t);
  }, []);

  const toggle = (f: FilterId) =>
    setFilters((prev) => {
      const n = new Set(prev);
      if (n.has(f)) n.delete(f);
      else n.add(f);
      return n;
    });

  return (
    <div className="pt-2">
      <header className="mb-4">
        <p className="eyebrow">NEELARYAN Café</p>
        <h1 className="mt-1 font-display text-[44px] font-semibold leading-none text-navy-900 md:text-[56px]">Menu</h1>
      </header>

      <div className="sticky top-16 z-30 -mx-4 bg-ivory/90 px-4 pb-2 pt-2 backdrop-blur-md md:top-20 md:-mx-8 md:px-8">
        <div className="relative">
          <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted" />
          <label htmlFor="menu-search" className="sr-only">
            Search the menu
          </label>
          <input
            id="menu-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for your favourites…"
            className="h-12 w-full rounded-full border border-sand-400 bg-white/85 pl-11 pr-11 text-[15.5px] outline-none placeholder:text-ink-muted focus:border-gold-500"
          />
          {query && (
            <button onClick={() => setQuery("")} className="absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-ink-muted hover:bg-cream" aria-label="Clear search">
              <X size={17} />
            </button>
          )}
        </div>
        <div className="no-scrollbar -mx-4 mt-2.5 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0" role="group" aria-label="Filters">
          {FILTERS.map((f) => {
            const on = filters.has(f.id);
            return (
              <button key={f.id} onClick={() => toggle(f.id)} aria-pressed={on} className={clsx("chip", on ? "border-navy-800 bg-navy-800 text-ivory" : "border-sand-400 bg-white/70 text-navy-800 hover:border-gold-500")}>
                {f.label}
              </button>
            );
          })}
        </div>
        {sections.length > 1 && (
          <div ref={tabs} className="no-scrollbar -mx-4 mt-2 flex gap-1 overflow-x-auto border-t border-sand-400/50 px-4 pt-2 md:mx-0 md:px-0" aria-label="Categories">
            {sections.map(({ cat }) => (
              <a
                key={cat.id}
                href={`#${cat.id}`}
                data-tab={cat.id}
                aria-current={active === cat.id ? "true" : undefined}
                className={clsx("relative shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 text-[14px] font-semibold transition-colors", active === cat.id ? "text-navy-900" : "text-ink-muted hover:text-navy-900")}
              >
                {active === cat.id && <motion.span layoutId="cat-pill" className="absolute inset-0 -z-10 rounded-full bg-gold-200" transition={{ type: "spring", stiffness: 420, damping: 36 }} />}
                {cat.short}
              </a>
            ))}
          </div>
        )}
      </div>

      <p className="sr-only" aria-live="polite">
        {count} items shown
      </p>

      {sections.length === 0 ? (
        <div className="mx-auto max-w-sm py-20 text-center">
          <p className="font-display text-[28px] font-semibold text-navy-900">Nothing matches that</p>
          <p className="mt-1 text-ink-soft">Try another word, or clear the filters.</p>
          <button
            className="btn-ghost mt-5"
            onClick={() => {
              setQuery("");
              setFilters(new Set());
            }}
          >
            Clear search & filters
          </button>
        </div>
      ) : (
        sections.map(({ cat, items }) => (
          <section key={cat.id} id={cat.id} className="scroll-mt-[190px] pt-8 md:scroll-mt-[210px]" aria-labelledby={`${cat.id}-h`}>
            <div className="mb-4">
              <h2 id={`${cat.id}-h`} className="font-display text-[30px] font-semibold leading-tight text-navy-900 md:text-[36px]">
                {cat.name}
              </h2>
              {cat.blurb && <p className="mt-0.5 text-[14px] italic text-gold-700">{cat.blurb}</p>}
            </div>
            <div className="grid gap-3 md:grid-cols-2 md:gap-4 lg:grid-cols-3 xl:grid-cols-4 [perspective:1400px]">
              {items.map((m) => (
                <ItemCard key={m.id} item={m} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
