import { clsx } from "@/lib/clsx";
import { Logo } from "./Logo";

/** The logo lockup sized for headers, with an optional small caption (e.g. "Staff console"). */
export function Wordmark({ className, sub, compact }: { className?: string; name?: string; sub?: string; compact?: boolean }) {
  return (
    <span className={clsx("inline-flex flex-col items-start", className)}>
      <Logo className={compact ? "w-[124px] sm:w-[148px]" : "w-[156px]"} />
      {sub && <span className="-mt-0.5 pl-[5%] text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">{sub}</span>}
    </span>
  );
}
