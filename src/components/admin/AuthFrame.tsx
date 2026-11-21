import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/brand/Wordmark";
import { ThemeSwitch } from "@/components/theme";

/** Quiet, centred frame for sign-in and password screens. */
export function AuthFrame({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="flex items-center justify-between px-5 py-4 md:px-8">
        <Link href="/" className="text-[30px]" aria-label="NEELARYAN — customer site">
          <Wordmark sub="Staff console" />
        </Link>
        <ThemeSwitch compact />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-16 pt-6 md:items-center md:pt-0">
        <div className="w-full max-w-[400px]">
          <h1 className="text-[24px] font-bold text-fg">{title}</h1>
          {subtitle && <p className="mt-1 text-[14px] text-muted">{subtitle}</p>}
          <div className="mt-6 rounded-xl border border-line bg-surface p-5 shadow-card md:p-6">{children}</div>
        </div>
      </main>
      <footer className="px-5 pb-5 text-center text-[12.5px] text-muted">NEELARYAN Café · Staff console</footer>
    </div>
  );
}
