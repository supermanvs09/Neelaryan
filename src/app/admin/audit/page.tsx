import type { Metadata } from "next";
import { requireUser } from "@/server/auth/current";
import { AuditPage } from "@/components/admin/AuditPage";

export const metadata: Metadata = { title: "Audit log" };

export default async function Page() {
  await requireUser("/admin/audit", "audit.view");
  return <AuditPage />;
}
