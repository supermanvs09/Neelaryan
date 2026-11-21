import type { Metadata } from "next";

export const metadata: Metadata = { title: "Offline" };

export default function Offline() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div className="max-w-sm">
        <p className="mx-auto grid h-12 w-12 place-items-center rounded-lg bg-primary text-[22px] font-bold text-primary-fg">N</p>
        <h1 className="mt-4 text-[22px] font-bold">You&apos;re offline</h1>
        <p className="mt-1 text-muted">Check your connection and try again. Any order you&apos;ve placed is safe — its status will update when you&apos;re back online.</p>
        {/* a full page load on purpose: the router can't help while offline */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" className="mt-5 inline-flex min-h-[46px] items-center rounded-lg bg-primary px-6 font-semibold text-primary-fg">
          Try again
        </a>
      </div>
    </main>
  );
}
