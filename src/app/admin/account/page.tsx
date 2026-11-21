import type { Metadata } from "next";
import { requireUser } from "@/server/auth/current";
import { AccountPage } from "@/components/admin/AccountPage";

export const metadata: Metadata = { title: "Your account" };

export default async function Page() {
  await requireUser("/admin/account");
  return <AccountPage />;
}
