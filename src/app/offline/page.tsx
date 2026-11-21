import type { Metadata } from "next";
import { Logo } from "@/components/brand/Logo";

export const metadata: Metadata = { title: "Offline" };

export default function Offline() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div className="max-w-sm">
        <Logo tagline className="mx-auto w-[220px]" />
        <h1 className="mt-8 font-display text-[26px] font-semibold">You&apos;re offline</h1>
        <p className="mt-1 text-muted">Check your connection and try again. Any order you&apos;ve placed is safe — its status will update when you&apos;re back online.</p>
        {/* a full page load on purpose: the router can't help while offline */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" className="mt-5 inline-flex min-h-[46px] items-center rounded-full bg-primary px-6 font-semibold text-primary-fg">
          Try again
        </a>
      </div>
    </main>
  );
}
