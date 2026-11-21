import type { Metadata } from "next";
import { requireUser } from "@/server/auth/current";
import { InventoryPage } from "@/components/admin/inventory/InventoryPage";

export const metadata: Metadata = { title: "Inventory" };

export default async function Page() {
  await requireUser("/admin/inventory", "inventory.view");
  return <InventoryPage />;
}
