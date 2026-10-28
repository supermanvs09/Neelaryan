"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { useUI } from "@/store/ui";

export function Toast() {
  const toast = useUI((s) => s.toast);
  const dismiss = useUI((s) => s.dismissToast);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(dismiss, 2600);
    return () => clearTimeout(t);
  }, [toast, dismiss]);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+12px)] z-[80] flex justify-center px-4" aria-live="polite" role="status">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            className="pointer-events-auto flex max-w-md items-center gap-2.5 rounded-full bg-navy-900 px-4 py-2.5 text-[14px] font-semibold text-ivory shadow-lift"
            initial={{ y: -30, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -20, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 30 }}
            onClick={dismiss}
          >
            {toast.tone === "ok" ? <CheckCircle2 size={18} className="text-gold-400" /> : <AlertTriangle size={18} className="text-gold-400" />}
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
