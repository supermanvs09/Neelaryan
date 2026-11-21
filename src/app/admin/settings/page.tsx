import type { Metadata } from "next";
import { requireUser } from "@/server/auth/current";
import { SettingsPage } from "@/components/admin/SettingsPage";

export const metadata: Metadata = { title: "Settings" };

export default async function Page() {
  await requireUser("/admin/settings", ["settings.manage", "orders.manage"]);
  return <SettingsPage />;
}
