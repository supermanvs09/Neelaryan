import type { Metadata } from "next";
import { headers } from "next/headers";
import { requireUser } from "@/server/auth/current";
import { AdminShell } from "@/components/admin/AdminShell";
import { getSetting } from "@/server/settings";

export const metadata: Metadata = { title: { default: "Console", template: "%s · NEELARYAN Console" }, robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const path = (await headers()).get("x-pathname") ?? "/admin";
  const user = await requireUser(path);
  const business = await getSetting("business");
  return (
    <AdminShell user={{ id: user.id, name: user.name, username: user.username, roleName: user.roleName, permissions: user.permissions }} businessName={business.name}>
      {children}
    </AdminShell>
  );
}
