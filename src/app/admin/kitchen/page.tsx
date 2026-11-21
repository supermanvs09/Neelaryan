import type { Metadata } from "next";
import { requireUser } from "@/server/auth/current";
import { KitchenBoard } from "@/components/admin/orders/KitchenBoard";

export const metadata: Metadata = { title: "Kitchen" };

export default async function Page() {
  await requireUser("/admin/kitchen", "kitchen.view");
  return <KitchenBoard />;
}
