import type { Metadata } from "next";
import { requireUser } from "@/server/auth/current";
import { NotificationsPage } from "@/components/admin/customers/NotificationsPage";

export const metadata: Metadata = { title: "Notifications & campaigns" };

export default async function Page() {
  await requireUser("/admin/notifications", "notifications.manage");
  return <NotificationsPage />;
}
