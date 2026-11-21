import type { Metadata } from "next";
import { requireUser } from "@/server/auth/current";
import { CustomersPage } from "@/components/admin/customers/CustomersPage";

export const metadata: Metadata = { title: "Customers" };

export default async function Page() {
  await requireUser("/admin/customers", "customers.view");
  return <CustomersPage />;
}
