"use client";

import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, Inbox, Loader2, X } from "lucide-react";
import { clsx } from "@/lib/clsx";
import type { ClientApiError } from "@/lib/api-client";

/* ── Buttons ─────────────────────────────────────────────────────────────── */

type Variant = "primary" | "secondary" | "ghost" | "danger" | "accent";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary text-primary-fg hover:bg-primary-hover border border-transparent",
  secondary: "bg-surface text-fg border border-line hover:border-line-strong hover:bg-surface-2",
  ghost: "text-fg border border-transparent hover:bg-surface-2",
  danger: "bg-danger text-[#fff] border border-transparent hover:opacity-90 dark:text-bg",
  accent: "bg-accent text-accent-fg border border-transparent hover:opacity-90",
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" | "lg"; loading?: boolean; icon?: ReactNode }
>(function Button({ variant = "primary", size = "md", loading, icon, className, children, disabled, type = "button", ...rest }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={clsx(
        "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-55",
        size === "sm" ? "h-8 px-3 text-[13px]" : size === "lg" ? "h-11 px-5 text-[15px]" : "h-10 px-4 text-[14px]",
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 size={16} className="animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

export function IconButton({ label, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button type="button" aria-label={label} title={label} className={clsx("grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-fg", className)} {...rest}>
      {children}
    </button>
  );
}

/* ── Form fields ─────────────────────────────────────────────────────────── */

export function Field({ label, hint, error, children, className, htmlFor, optional }: { label: ReactNode; hint?: ReactNode; error?: string | null; children: ReactNode; className?: string; htmlFor?: string; optional?: boolean }) {
  return (
    <div className={clsx("min-w-0", className)}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-semibold text-fg">
        {label} {optional && <span className="font-normal text-muted">(optional)</span>}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-[12.5px] font-medium text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-[12.5px] text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean; prefix?: string; suffix?: string }>(function Input(
  { invalid, className, prefix, suffix, ...rest },
  ref,
) {
  if (prefix || suffix) {
    return (
      <div className="relative">
        {prefix && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-muted">{prefix}</span>}
        <input ref={ref} aria-invalid={invalid || undefined} className={clsx("field-input", prefix && "pl-7", suffix && "pr-12", className)} {...rest} />
        {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-muted">{suffix}</span>}
      </div>
    );
  }
  return <input ref={ref} aria-invalid={invalid || undefined} className={clsx("field-input", className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(function Textarea({ invalid, className, ...rest }, ref) {
  return <textarea ref={ref} aria-invalid={invalid || undefined} className={clsx("field-input h-auto min-h-[84px] py-2", className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>(function Select({ invalid, className, children, ...rest }, ref) {
  return (
    <select ref={ref} aria-invalid={invalid || undefined} className={clsx("field-input appearance-none bg-[length:16px] bg-[right_10px_center] bg-no-repeat pr-9", className)} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%237d8899' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }} {...rest}>
      {children}
    </select>
  );
});

export function Checkbox({ label, checked, onChange, hint, disabled }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; hint?: ReactNode; disabled?: boolean }) {
  const id = useId();
  return (
    <div className="flex items-start gap-2.5">
      <input id={id} type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 rounded border-line-strong accent-[rgb(var(--primary))]" />
      <label htmlFor={id} className="text-[14px] leading-tight text-fg">
        {label}
        {hint && <span className="mt-0.5 block text-[12.5px] text-muted">{hint}</span>}
      </label>
    </div>
  );
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx("relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50", checked ? "bg-primary" : "bg-line-strong")}
    >
      <span className={clsx("absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow transition-[left] dark:bg-bg", checked ? "left-[22px]" : "left-0.5")} />
    </button>
  );
}

/* ── Layout ──────────────────────────────────────────────────────────────── */

export function PageHeader({ title, description, actions, back }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; back?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {back}
        <h1 className="text-[22px] font-bold tracking-[-0.01em] text-fg md:text-[24px]">{title}</h1>
        {description && <p className="mt-0.5 max-w-2xl text-[14px] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, actions, children, className, padded = true, description }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; padded?: boolean; description?: ReactNode }) {
  return (
    <section className={clsx("min-w-0 rounded-xl border border-line bg-surface", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <div>
            {title && <h2 className="text-[15px] font-bold text-fg">{title}</h2>}
            {description && <p className="text-[12.5px] text-muted">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={clsx(padded && "p-4")}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, sub, tone = "default", href }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "default" | "accent" | "warning" | "danger" | "success"; href?: string }) {
  const body = (
    <>
      <p className="text-[12.5px] font-semibold text-muted">{label}</p>
      <p className={clsx("num mt-1 text-[24px] font-bold leading-tight", tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : tone === "success" ? "text-success" : "text-fg")}>{value}</p>
      {sub && <p className="mt-0.5 text-[12.5px] text-muted">{sub}</p>}
    </>
  );
  const cls = clsx("block min-w-0 rounded-xl border border-line bg-surface px-4 py-3", tone === "accent" && "border-accent/60 bg-accent-soft/40");
  return href ? (
    <a href={href} className={clsx(cls, "transition-colors hover:border-line-strong")}>
      {body}
    </a>
  ) : (
    <div className={cls}>{body}</div>
  );
}

const BADGE: Record<string, string> = {
  neutral: "bg-surface-2 text-fg",
  primary: "bg-primary-soft text-fg",
  accent: "bg-accent-soft text-accent-text",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
};
export type BadgeTone = keyof typeof BADGE;
export function Badge({ tone = "neutral", children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return <span className={clsx("inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-[12px] font-semibold", BADGE[tone], className)}>{children}</span>;
}

export function Tabs<T extends string>({ value, onChange, items, className }: { value: T; onChange: (v: T) => void; items: { value: T; label: ReactNode }[]; className?: string }) {
  return (
    <div role="tablist" className={clsx("no-scrollbar flex gap-1 overflow-x-auto border-b border-line", className)}>
      {items.map((i) => (
        <button
          key={i.value}
          role="tab"
          aria-selected={value === i.value}
          onClick={() => onChange(i.value)}
          className={clsx(
            "-mb-px shrink-0 border-b-2 px-3 py-2.5 text-[14px] font-semibold transition-colors",
            value === i.value ? "border-primary text-fg" : "border-transparent text-muted hover:text-fg",
          )}
        >
          {i.label}
        </button>
      ))}
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, items, label }: { value: T; onChange: (v: T) => void; items: { value: T; label: ReactNode }[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap rounded-lg border border-line bg-surface p-0.5">
      {items.map((i) => (
        <button
          key={i.value}
          type="button"
          role="radio"
          aria-checked={value === i.value}
          onClick={() => onChange(i.value)}
          className={clsx("h-8 rounded-md px-3 text-[13px] font-semibold transition-colors", value === i.value ? "bg-primary-soft text-fg" : "text-muted hover:text-fg")}
        >
          {i.label}
        </button>
      ))}
    </div>
  );
}

/* ── States ──────────────────────────────────────────────────────────────── */

export function Empty({ title, children, action, icon }: { title: string; children?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-surface-2 text-muted">{icon ?? <Inbox size={22} aria-hidden />}</div>
      <p className="text-[15px] font-bold text-fg">{title}</p>
      {children && <p className="mt-1 max-w-sm text-[13.5px] text-muted">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={clsx("skeleton rounded-lg", className)} />;
}

export function LoadingBlock({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2.5 p-1" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-10" />
      ))}
    </div>
  );
}

export function ErrorBlock({ error, retry }: { error: ClientApiError | Error | null; retry?: () => void }) {
  if (!error) return null;
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-[14px] text-danger">
      <span className="flex items-center gap-2">
        <AlertTriangle size={16} aria-hidden /> {error.message}
      </span>
      {retry && (
        <Button size="sm" variant="secondary" onClick={retry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function Notice({ tone = "primary", children, className }: { tone?: "primary" | "warning" | "danger" | "success"; children: ReactNode; className?: string }) {
  const t = { primary: "bg-primary-soft text-fg", warning: "bg-warning-soft text-warning", danger: "bg-danger-soft text-danger", success: "bg-success-soft text-success" }[tone];
  return <div className={clsx("rounded-lg px-3.5 py-2.5 text-[13.5px]", t, className)}>{children}</div>;
}

/* ── Table (cards on phones) ─────────────────────────────────────────────── */

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
  /** Hide on phone cards (still visible in the table). */
  hideOnCard?: boolean;
  /** Use as the card title on phones. */
  primary?: boolean;
}

export function DataTable<T>({ rows, columns, rowKey, onRowClick, empty, footer, dense }: { rows: T[]; columns: Column<T>[]; rowKey: (r: T) => string; onRowClick?: (r: T) => void; empty?: ReactNode; footer?: ReactNode; dense?: boolean }) {
  if (!rows.length) return <>{empty ?? <Empty title="Nothing here yet" />}</>;
  const primary = columns.find((c) => c.primary) ?? columns[0];
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-[14px]">
          <thead>
            <tr className="border-b border-line bg-surface-2/60">
              {columns.map((c) => (
                <th key={c.key} scope="col" className={clsx("whitespace-nowrap px-4 py-2.5 text-[12px] font-bold uppercase tracking-wide text-muted", c.align === "right" && "text-right", c.align === "center" && "text-center")}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={rowKey(r)}
                onClick={onRowClick ? () => onRowClick(r) : undefined}
                className={clsx("border-b border-line last:border-b-0", onRowClick && "cursor-pointer hover:bg-surface-2/50")}
              >
                {columns.map((c) => (
                  <td key={c.key} className={clsx(dense ? "px-4 py-2" : "px-4 py-3", "align-middle text-fg", c.align === "right" && "text-right", c.align === "center" && "text-center", c.className)}>
                    {c.cell(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {footer && <tfoot>{footer}</tfoot>}
        </table>
      </div>
      <ul className="divide-y divide-line md:hidden">
        {rows.map((r) => (
          <li key={rowKey(r)}>
            <div
              role={onRowClick ? "button" : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
              onKeyDown={onRowClick ? (e) => e.key === "Enter" && onRowClick(r) : undefined}
              className={clsx("px-4 py-3", onRowClick && "active:bg-surface-2")}
            >
              <div className="font-semibold text-fg">{primary.cell(r)}</div>
              <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-[13px]">
                {columns
                  .filter((c) => c !== primary && !c.hideOnCard)
                  .map((c) => (
                    <div key={c.key} className="min-w-0">
                      <dt className="text-[11.5px] text-muted">{c.header}</dt>
                      <dd className="truncate text-fg">{c.cell(r)}</dd>
                    </div>
                  ))}
              </dl>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

/* ── Dialogs ─────────────────────────────────────────────────────────────── */

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  side = false,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  /** Side drawer on larger screens (editors). */
  side?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => {
      const first = panel.current?.querySelector<HTMLElement>("input:not([type=hidden]),select,textarea,button:not([data-close])");
      (first ?? panel.current)?.focus();
    }, 20);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && panel.current) {
        const f = panel.current.querySelectorAll<HTMLElement>("a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex='-1'])");
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open || !mounted) return null;
  const width = { sm: "md:max-w-md", md: "md:max-w-xl", lg: "md:max-w-3xl", xl: "md:max-w-5xl" }[size];
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center md:items-center" role="presentation">
      <div className="absolute inset-0 bg-black/45" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={clsx(
          "relative flex max-h-[92dvh] w-full flex-col overflow-hidden border border-line bg-surface shadow-pop outline-none",
          side ? "rounded-t-2xl md:ml-auto md:h-dvh md:max-h-none md:rounded-none md:rounded-l-2xl" : "rounded-t-2xl md:mx-4 md:rounded-2xl",
          width,
        )}
      >
        <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-[17px] font-bold text-fg">
              {title}
            </h2>
            {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
          </div>
          <IconButton label="Close" onClick={onClose} data-close>
            <X size={18} />
          </IconButton>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3 pb-[calc(env(safe-area-inset-bottom)+12px)] md:pb-3">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}

/** Confirm dialog with optional required reason. */
export function useConfirm() {
  const [state, setState] = useState<{
    title: string;
    body?: ReactNode;
    confirm: string;
    danger?: boolean;
    reason?: { label: string; required?: boolean; value?: string; single?: boolean };
    resolve: (v: { ok: boolean; reason: string }) => void;
  } | null>(null);
  const [reason, setReason] = useState("");
  const ask = useCallback(
    (o: { title: string; body?: ReactNode; confirm?: string; danger?: boolean; reason?: { label: string; required?: boolean; value?: string; single?: boolean } }) =>
      new Promise<{ ok: boolean; reason: string }>((resolve) => {
        setReason(o.reason?.value ?? "");
        setState({ confirm: "Confirm", ...o, resolve });
      }),
    [],
  );
  const close = (ok: boolean) => {
    state?.resolve({ ok, reason: reason.trim() });
    setState(null);
  };
  const node = (
    <Dialog
      open={!!state}
      onClose={() => close(false)}
      title={state?.title ?? ""}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button variant={state?.danger ? "danger" : "primary"} disabled={!!state?.reason?.required && !reason.trim()} onClick={() => close(true)}>
            {state?.confirm}
          </Button>
        </>
      }
    >
      {state?.body && <div className="text-[14px] text-fg">{state.body}</div>}
      {state?.reason && (
        <Field label={state.reason.label} className="mt-3">
          {state.reason.single ? (
            <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={80} onKeyDown={(e) => e.key === "Enter" && reason.trim() && close(true)} />
          ) : (
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} rows={2} />
          )}
        </Field>
      )}
    </Dialog>
  );
  return { ask, node };
}

/* ── Toasts ──────────────────────────────────────────────────────────────── */

interface Toast {
  id: number;
  text: string;
  tone: "success" | "error";
}
const ToastCtx = createContext<(text: string, tone?: Toast["tone"]) => void>(() => undefined);
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: Toast["tone"] = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "error" ? 6000 : 3200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[90] flex flex-col items-center gap-2 px-4 md:bottom-6 md:items-end md:pr-6" aria-live="polite" role="status">
        {toasts.map((t) => (
          <div key={t.id} className={clsx("pointer-events-auto flex max-w-md items-start gap-2 rounded-lg border px-4 py-2.5 text-[14px] font-medium shadow-pop", t.tone === "error" ? "border-danger/30 bg-danger-soft text-danger" : "border-line bg-surface text-fg")}>
            {t.tone === "error" ? <AlertTriangle size={17} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-success" />}
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
