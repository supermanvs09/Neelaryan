import type { Metadata } from "next";
import { requireUser } from "@/server/auth/current";
import { MenuManager } from "@/components/admin/menu/MenuManager";

export const metadata: Metadata = { title: "Menu" };

export default async function Page() {
  await requireUser("/admin/menu", "menu.view");
  return <MenuManager />;
}
