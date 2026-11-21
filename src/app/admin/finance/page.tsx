import type { Metadata } from "next";
import { requireUser } from "@/server/auth/current";
import { FinancePage } from "@/components/admin/finance/FinancePage";

export const metadata: Metadata = { title: "Finance & P&L" };

export default async function Page() {
  await requireUser("/admin/finance", "finance.view");
  return <FinancePage />;
}
