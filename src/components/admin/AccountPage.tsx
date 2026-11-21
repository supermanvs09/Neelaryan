"use client";

import { Card, PageHeader } from "./ui";
import { useAdminUser } from "./AdminShell";
import { ChangePasswordForm } from "./ChangePasswordForm";
import { ThemeSwitch } from "@/components/theme";

export function AccountPage() {
  const u = useAdminUser();
  return (
    <>
      <PageHeader title="Your account" description={`${u.name} · @${u.username} · ${u.roleName}`} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Change password" description="Changing it signs you out on every other device.">
          <ChangePasswordForm username={u.username} forced={false} />
        </Card>
        <Card title="Appearance" description="Saved on this device.">
          <ThemeSwitch />
        </Card>
      </div>
    </>
  );
}
