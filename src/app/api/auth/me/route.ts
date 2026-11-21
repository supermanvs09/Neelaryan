import { api } from "@/server/http";

export const GET = api(
  async ({ user }) => {
    const u = user!;
    return {
      user: { id: u.id, username: u.username, name: u.name, email: u.email, role: u.role, roleName: u.roleName, permissions: u.permissions, mustChangePassword: u.mustChangePassword },
    };
  },
  { allowPendingPasswordChange: true },
);
