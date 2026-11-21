import type { Metadata } from "next";
import { requireUser } from "@/server/auth/current";
import { OffersPage } from "@/components/admin/OffersPage";

export const metadata: Metadata = { title: "Offers" };

export default async function Page() {
  await requireUser("/admin/offers", ["menu.view", "reports.view"]);
  return <OffersPage />;
}
