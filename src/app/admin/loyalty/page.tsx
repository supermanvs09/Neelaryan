import type { Metadata } from "next";
import { requireUser } from "@/server/auth/current";
import { LoyaltyPage } from "@/components/admin/customers/LoyaltyPage";

export const metadata: Metadata = { title: "Loyalty & rewards" };

export default async function Page() {
  await requireUser("/admin/loyalty", "loyalty.manage");
  return <LoyaltyPage />;
}
