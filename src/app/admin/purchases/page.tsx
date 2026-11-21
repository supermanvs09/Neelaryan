import type { Metadata } from "next";
import { requireUser } from "@/server/auth/current";
import { PurchasesPage } from "@/components/admin/inventory/PurchasesPage";

export const metadata: Metadata = { title: "Purchases & suppliers" };

export default async function Page() {
  await requireUser("/admin/purchases", "purchases.manage");
  return <PurchasesPage />;
}
