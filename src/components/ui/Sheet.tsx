"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
import { useEscape, useScrollLock } from "@/lib/hooks";
import { clsx } from "@/lib/clsx";

/**
 * Bottom sheet on phones, centred dialog (or side drawer) on larger screens.
 * Swipe down on the handle to dismiss on touch devices.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  variant = "dialog",
  labelledBy,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  variant?: "dialog" | "drawer";
  labelledBy?: string;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  useScrollLock(open);
  useEscape(open, onClose);

  // focus the panel for keyboard & screen-reader users, restore on close
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => panel.current?.focus(), 30);
    return () => {
      clearTimeout(t);
      prev?.focus?.();
    };
  }, [open]);

  const drawer = variant === "drawer";

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60]" role="presentation">
          <motion.div
            className="absolute inset-0 bg-navy-950/45 backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy ?? (title ? id : undefined)}
            tabIndex={-1}
            className={clsx(
              "absolute flex max-h-[92dvh] flex-col overflow-hidden bg-ivory shadow-sheet outline-none",
              "inset-x-0 bottom-0 rounded-t-[28px]",
              drawer
                ? "md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[440px] md:rounded-none md:rounded-l-[28px]"
                : "md:inset-auto md:left-1/2 md:top-1/2 md:w-[min(92vw,760px)] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[28px]",
              className,
            )}
            initial={reduced ? { opacity: 0 } : { y: "100%", opacity: 0.6 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduced ? { opacity: 0 } : { y: "100%", opacity: 0.6 }}
            transition={{ type: "spring", stiffness: 340, damping: 34 }}
            drag={reduced ? false : "y"}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            dragListener={false}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) onClose();
            }}
          >
            <SheetHandle />
            {title !== undefined && (
              <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-1 md:px-7 md:pt-5">
                <h2 id={id} className="font-display text-[26px] font-semibold leading-tight text-navy-900">
                  {title}
                </h2>
                <button onClick={onClose} className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-sand-400 bg-white/70 text-navy-800 hover:border-gold-500" aria-label="Close">
                  <X size={20} />
                </button>
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
            {footer && <div className="border-t border-sand-400/60 bg-ivory/95 px-5 pb-safe pt-3 md:px-7">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function SheetHandle() {
  return (
    <div className="flex justify-center pb-1 pt-2.5 md:hidden" aria-hidden>
      <span className="h-1.5 w-11 rounded-full bg-sand-400" />
    </div>
  );
}
