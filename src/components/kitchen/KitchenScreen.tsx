"use client";

import { KitchenBoard } from "@/components/admin/orders/KitchenBoard";
import { ToastProvider } from "@/components/admin/ui";
import { apiFetch } from "@/lib/api-client";
import { ThemeSwitch } from "@/components/theme";

/** The kitchen board on the owner's secret link: tablet on the wall, no sign-in, forward moves only. */
export function KitchenScreen({ k }: { k: string }) {
  const url = `/api/kitchen-screen/${encodeURIComponent(k)}`;
  return (
    <ToastProvider>
      <main className="mx-auto max-w-[1500px] px-4 py-4 md:px-6">
        <KitchenBoard feed={url} move={(id, to) => apiFetch(url, { body: { order_id: id, to } })} extras={<ThemeSwitch compact />} />
      </main>
    </ToastProvider>
  );
}
