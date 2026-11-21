import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { currentUser } from "@/server/auth/current";
import { LoginForm } from "./LoginForm";
import { AuthFrame } from "@/components/admin/AuthFrame";

export const metadata: Metadata = { title: "Staff sign in" };
export const dynamic = "force-dynamic";

const safeNext = (n: string | undefined) => (n && n.startsWith("/admin") && !n.startsWith("//") ? n : "/admin");

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const user = await currentUser();
  if (user) redirect(user.mustChangePassword ? "/change-password" : safeNext(next));
  return (
    <AuthFrame title="Staff sign in" subtitle="Orders, kitchen, menu, stock and reports — all in one place.">
      <LoginForm next={safeNext(next)} />
    </AuthFrame>
  );
}
