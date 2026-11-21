import type { Metadata } from "next";
import { requireUser } from "@/server/auth/current";
import { StaffPage } from "@/components/admin/StaffPage";

export const metadata: Metadata = { title: "Staff & permissions" };

export default async function Page() {
  await requireUser("/admin/staff", "staff.manage");
  return <StaffPage />;
}
