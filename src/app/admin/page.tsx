import type { Metadata } from "next";
import { requireUser } from "@/server/auth/current";
import { DashboardPage } from "@/components/admin/DashboardPage";

export const metadata: Metadata = { title: "Dashboard" };

export default async function Page() {
  await requireUser("/admin", "dashboard.view");
  return <DashboardPage />;
}
