import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { currentUser } from "@/server/auth/current";
import { AuthFrame } from "@/components/admin/AuthFrame";
import { ChangePasswordForm } from "@/components/admin/ChangePasswordForm";

export const metadata: Metadata = { title: "Change password" };
export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return (
    <AuthFrame
      title={user.mustChangePassword ? "Set your own password" : "Change password"}
      subtitle={user.mustChangePassword ? "For security, choose a new password before you continue. The initial password can't be used again." : undefined}
    >
      <ChangePasswordForm username={user.username} forced={user.mustChangePassword} />
    </AuthFrame>
  );
}
