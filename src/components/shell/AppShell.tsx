"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence } from "motion/react";
import { useApp } from "@/store/app";
import { ORDERS_KEY, useOrders } from "@/store/orders";
import { useUI } from "@/store/ui";
import { TABLES } from "@/data/config";
import { Backdrop } from "../Backdrop";
import { Splash } from "./Splash";
import { Header } from "./Header";
import { BottomNav } from "./BottomNav";
import { CartPanel } from "./CartPanel";
import { Toast } from "./Toast";
import { FlyLayer } from "./FlyLayer";
import { KitchenSimulator } from "./KitchenSimulator";

const SPLASH_KEY = "neelaryan:splash-seen";

export function AppShell({ children }: { children: ReactNode }) {
  const [splash, setSplash] = useState(false);

  useEffect(() => {
    useApp.persist.rehydrate();
    useOrders.getState().sync();

    // other tabs (e.g. the Staff KDS) update orders → refresh ours
    const onStorage = (e: StorageEvent) => {
      if (e.key === ORDERS_KEY) useOrders.getState().sync();
    };
    window.addEventListener("storage", onStorage);

    try {
      if (!sessionStorage.getItem(SPLASH_KEY)) setSplash(true);
    } catch {
      /* storage blocked — skip the splash */
    }

    // table QR codes open the site with ?table=07
    const url = new URL(window.location.href);
    const table = url.searchParams.get("table");
    if (table) {
      const t = table.padStart(2, "0");
      const apply = () => {
        if (TABLES.includes(t)) {
          useApp.getState().setMode("dine-in", t);
          useUI.getState().showToast(`Welcome! You're at Table ${t}`);
        } else {
          useUI.getState().showToast("We couldn't read that table code — please choose your table", "warn");
        }
      };
      if (useApp.persist.hasHydrated()) apply();
      else useApp.persist.onFinishHydration(apply);
      url.searchParams.delete("table");
      window.history.replaceState(null, "", url.pathname + (url.search ? url.search : "") + url.hash);
    }
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const endSplash = () => {
    setSplash(false);
    try {
      sessionStorage.setItem(SPLASH_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  return (
    <>
      <Backdrop />
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[90] focus:rounded-full focus:bg-navy-800 focus:px-4 focus:py-2 focus:text-ivory">
        Skip to content
      </a>
      <Header />
      <main id="main" className="relative mx-auto w-full max-w-[1320px] px-4 pb-[calc(env(safe-area-inset-bottom)+7.5rem)] pt-2 md:px-8 md:pb-16">
        {children}
      </main>
      <BottomNav />
      <CartPanel />
      <Toast />
      <FlyLayer />
      <KitchenSimulator />
      <AnimatePresence>{splash && <Splash onDone={endSplash} />}</AnimatePresence>
    </>
  );
}
