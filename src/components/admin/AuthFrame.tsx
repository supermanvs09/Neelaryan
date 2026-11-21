import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";
import { ThemeSwitch } from "@/components/theme";

/** Sign-in and password screens: the brand sign on one side, a calm form on the other. */
export function AuthFrame({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="grid min-h-dvh bg-bg lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <aside className="relative hidden flex-col justify-center overflow-hidden bg-brand-navy px-12 py-12 xl:px-16 lg:flex" aria-hidden>
        {/* the whole sign, framed — never cropped */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/neelaryan-sign.webp" alt="" className="w-full rounded-2xl shadow-[0_30px_60px_-30px_rgba(0,0,0,0.7)] ring-1 ring-[#E2BF7A]/30" />
        <div className="mt-12 max-w-lg">
          <div className="mb-5 h-px w-16 bg-[#C29545]" />
          <p className="font-display text-[30px] font-semibold leading-tight text-[#FAF6EC]">Everything the café runs on, in one place.</p>
          <p className="mt-3 text-[15px] leading-relaxed text-[#FAF6EC]/75">Orders, kitchen, stock, money and guests — each team sees exactly what their role allows.</p>
        </div>
      </aside>
      <div className="flex min-h-dvh flex-col">
        <header className="flex items-center justify-between px-5 py-4 md:px-10">
          <Link href="/" aria-label="Neelaryan — customer site" className="lg:invisible">
            <Logo className="w-[132px]" />
          </Link>
          <ThemeSwitch compact />
        </header>
        <main className="flex flex-1 items-start justify-center px-5 pb-16 pt-4 md:items-center md:pt-0">
          <div className="w-full max-w-[400px]">
            <p className="eyebrow">Staff console</p>
            <h1 className="mt-1.5 font-display text-[30px] font-semibold leading-tight text-fg">{title}</h1>
            {subtitle && <p className="mt-1.5 text-[14.5px] text-muted">{subtitle}</p>}
            <div className="mt-6 rounded-2xl border border-line bg-surface p-6 shadow-lift">{children}</div>
          </div>
        </main>
        <footer className="px-5 pb-5 text-center text-[12.5px] text-muted">© Neelaryan Café · Crave the goodness.</footer>
      </div>
    </div>
  );
}
