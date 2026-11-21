import type { Metadata } from "next";
import { requireUser } from "@/server/auth/current";
import { ReportsPage } from "@/components/admin/finance/ReportsPage";

export const metadata: Metadata = { title: "Reports" };

export default async function Page() {
  await requireUser("/admin/reports", "reports.view");
  return <ReportsPage />;
}
