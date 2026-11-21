import type { Metadata } from "next";
import { requireUser } from "@/server/auth/current";
import { PosPage } from "@/components/admin/orders/PosPage";

export const metadata: Metadata = { title: "New order" };

export default async function Page() {
  await requireUser("/admin/orders/new", "orders.create");
  return <PosPage />;
}
