import type { Metadata } from "next";
import { requireUser } from "@/server/auth/current";
import { TablesPage } from "@/components/admin/TablesPage";

export const metadata: Metadata = { title: "Tables & QR codes" };

export default async function Page() {
  await requireUser("/admin/tables", "tables.view");
  return <TablesPage />;
}
