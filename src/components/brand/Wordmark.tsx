import { clsx } from "@/lib/clsx";

/** Plain text logo: monogram tile + name. */
export function Wordmark({ className, name = "NEELARYAN", sub, compact }: { className?: string; name?: string; sub?: string; compact?: boolean }) {
  return (
    <span className={clsx("inline-flex items-center gap-2.5", className)}>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#23324C] text-[17px] font-bold text-[#F4EEE2] dark:bg-[#B58A45] dark:text-[#23324C]" aria-hidden>
        N
      </span>
      <span className={clsx("leading-tight", compact && "hidden sm:block")}>
        <span className="block text-[16px] font-bold tracking-[0.06em] text-fg">{name}</span>
        {sub && <span className="block text-[12px] font-medium text-muted">{sub}</span>}
      </span>
    </span>
  );
}
