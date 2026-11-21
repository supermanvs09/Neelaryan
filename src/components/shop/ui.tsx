"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { create } from "zustand";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CheckCircle2, AlertCircle, Minus, Plus, X } from "lucide-react";
import { useEscape, useScrollLock } from "@/lib/hooks";
import { clsx } from "@/lib/clsx";

export const rupee = (n: number) => `₹${(Math.round(n * 100) / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

/** Indian food-type mark: green (veg), red-brown triangle (non-veg), amber (egg). */
export function DietMark({ diet, className }: { diet: "veg" | "egg" | "nonveg"; className?: string }) {
  const color = diet === "veg" ? "border-veg text-veg" : diet === "egg" ? "border-egg text-egg" : "border-nonveg text-nonveg";
  const label = diet === "veg" ? "Vegetarian" : diet === "egg" ? "Contains egg" : "Non-vegetarian";
  return (
    <span role="img" aria-label={label} title={label} className={clsx("inline-grid h-[15px] w-[15px] shrink-0 place-items-center rounded-[3px] border-[1.5px] bg-[#fff]", color, className)}>
      {diet === "nonveg" ? (
        <svg viewBox="0 0 10 10" className="h-[7px] w-[7px]" aria-hidden>
          <path d="M5 1 L9 9 L1 9 Z" fill="currentColor" />
        </svg>
      ) : (
        <span className="h-[7px] w-[7px] rounded-full bg-current" />
      )}
    </span>
  );
}

export function Stepper({ value, onChange, min = 0, max = 50, label, size = "md" }: { value: number; onChange: (v: number) => void; min?: number; max?: number; label: string; size?: "sm" | "md" }) {
  const b = size === "sm" ? "h-9 w-9" : "h-11 w-11";
  return (
    <div className="inline-flex items-center rounded-full border border-line bg-surface" role="group" aria-label={label}>
      <button type="button" className={clsx(b, "grid place-items-center rounded-full text-fg hover:bg-surface-2 disabled:opacity-40")} onClick={() => onChange(value - 1)} disabled={value <= min} aria-label={`Fewer ${label}`}>
        <Minus size={16} />
      </button>
      <span className="num w-7 text-center text-[15px] font-bold" aria-live="polite">
        {value}
      </span>
      <button type="button" className={clsx(b, "grid place-items-center rounded-full text-fg hover:bg-surface-2 disabled:opacity-40")} onClick={() => onChange(value + 1)} disabled={value >= max} aria-label={`More ${label}`}>
        <Plus size={16} />
      </button>
    </div>
  );
}

/** Bottom sheet on phones, centred dialog (or side drawer) on larger screens. */
export function Sheet({ open, onClose, title, children, footer, side = false, wide = false }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; footer?: ReactNode; side?: boolean; wide?: boolean }) {
  const reduced = useReducedMotion();
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  useScrollLock(open);
  useEscape(open, onClose);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => panel.current?.focus(), 30);
    return () => {
      clearTimeout(t);
      prev?.focus?.();
    };
  }, [open]);
  const dur = reduced ? 0 : 0.22;
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60]" role="presentation">
          <motion.div className="absolute inset-0 bg-[#0b111c]/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: dur }} onClick={onClose} />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? id : undefined}
            tabIndex={-1}
            initial={side ? { x: "100%" } : { y: "100%" }}
            animate={side ? { x: 0 } : { y: 0 }}
            exit={side ? { x: "100%" } : { y: "100%" }}
            transition={{ duration: dur, ease: [0.2, 0.8, 0.2, 1] }}
            className={clsx(
              "absolute flex flex-col bg-surface text-fg shadow-sheet outline-none",
              side
                ? "inset-y-0 right-0 w-full max-w-[440px] md:border-l md:border-line"
                : clsx("inset-x-0 bottom-0 max-h-[92dvh] rounded-t-3xl md:inset-x-auto md:left-1/2 md:bottom-auto md:top-1/2 md:max-h-[86dvh] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-3xl md:border md:border-line", wide ? "md:w-[760px]" : "md:w-[520px]"),
            )}
          >
            <div className="flex items-center gap-3 border-b border-line px-5 py-3.5">
              {!side && <span className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-line-strong md:hidden" aria-hidden />}
              {title && (
                <h2 id={id} className="min-w-0 flex-1 truncate text-[17px] font-bold">
                  {title}
                </h2>
              )}
              <button type="button" onClick={onClose} className="-mr-2 ml-auto grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-fg" aria-label="Close">
                <X size={19} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
            {footer && <div className="border-t border-line px-5 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/* ── Toasts ─────────────────────────────────────────────────────────────── */

interface ToastState {
  t: { id: number; text: string; tone: "ok" | "warn" } | null;
  show: (text: string, tone?: "ok" | "warn") => void;
  hide: () => void;
}
let tid = 0;
export const useToastStore = create<ToastState>((set) => ({ t: null, show: (text, tone = "ok") => set({ t: { id: ++tid, text, tone } }), hide: () => set({ t: null }) }));
export const toast = (text: string, tone: "ok" | "warn" = "ok") => useToastStore.getState().show(text, tone);

export function ToastHost() {
  const t = useToastStore((s) => s.t);
  const hide = useToastStore((s) => s.hide);
  useEffect(() => {
    if (!t) return;
    const h = setTimeout(hide, 3200);
    return () => clearTimeout(h);
  }, [t, hide]);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+9rem)] z-[70] flex justify-center px-4 md:bottom-8" aria-live="polite">
      <AnimatePresence>
        {t && (
          <motion.div key={t.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.18 }} className="pointer-events-auto flex max-w-md items-center gap-2 rounded-full bg-[#1b2740] px-4 py-2.5 text-[14px] font-semibold text-[#fff] shadow-pop">
            {t.tone === "ok" ? <CheckCircle2 size={17} className="text-[#8fd3a6]" aria-hidden /> : <AlertCircle size={17} className="text-[#f2c27b]" aria-hidden />}
            {t.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <span className={clsx("inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent", className)} aria-hidden />;
}

export function ShopButton({ children, variant = "primary", className, loading, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "accent"; loading?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      disabled={rest.disabled || loading}
      className={clsx(
        "inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full px-6 text-[15px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-55",
        variant === "primary" && "bg-primary text-primary-fg hover:bg-primary-hover",
        variant === "accent" && "bg-accent text-accent-fg hover:opacity-90",
        variant === "secondary" && "border border-line bg-surface text-fg hover:border-line-strong",
        variant === "ghost" && "text-fg hover:bg-surface-2",
        className,
      )}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
}
