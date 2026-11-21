import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, userFromToken, type SessionUser } from "./session";
import type { Permission } from "./permissions";
import { homeFor } from "@/components/admin/nav";

/** Current staff user in a server component (null when signed out). */
export async function currentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  return userFromToken(jar.get(SESSION_COOKIE)?.value);
}

/** Server-side page guard: signed in, password changed, and (optionally) permitted. */
export async function requireUser(next: string, permission?: Permission | Permission[]) {
  const user = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (user.mustChangePassword) redirect("/change-password");
  if (permission) {
    const need = Array.isArray(permission) ? permission : [permission];
    if (!need.some((p) => user.permissions.includes(p))) redirect(homeFor(user.permissions));
  }
  return user;
}
