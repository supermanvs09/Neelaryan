import type { Metadata } from "next";
import { requireUser } from "@/server/auth/current";
import { FeedbackPage } from "@/components/admin/FeedbackPage";

export const metadata: Metadata = { title: "Guest feedback" };

export default async function Page() {
  await requireUser("/admin/feedback", ["customers.view", "reports.view"]);
  return <FeedbackPage />;
}
