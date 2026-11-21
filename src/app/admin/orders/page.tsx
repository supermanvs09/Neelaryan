import type { Metadata } from "next";
import { requireUser } from "@/server/auth/current";
import { OrdersPage } from "@/components/admin/orders/OrdersPage";

export const metadata: Metadata = { title: "Orders" };

export default async function Page() {
  await requireUser("/admin/orders", "orders.view");
  return <OrdersPage />;
}
