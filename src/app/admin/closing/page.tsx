import type { Metadata } from "next";
import { requireUser } from "@/server/auth/current";
import { ClosingPage } from "@/components/admin/ClosingPage";

export const metadata: Metadata = { title: "Close the day" };

export default async function Page() {
  await requireUser("/admin/closing", ["finance.view", "billing.refund"]);
  return <ClosingPage />;
}
