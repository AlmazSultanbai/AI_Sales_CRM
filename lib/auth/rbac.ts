import { UserRole } from "@/types/domain";

const permissions: Record<UserRole, string[]> = {
  admin: [
    "catalog:read",
    "catalog:write",
    "stocks:read",
    "stocks:write",
    "movements:read",
    "movements:write",
    "stores:read",
    "stores:write",
    "debts:read",
    "debts:write",
    "exports:read",
    "exports:write",
    "orders:read",
    "orders:write",
    "users:write",
  ],
  user: [
    "catalog:read",
    "stocks:read",
    "movements:read",
    "stores:read",
    "debts:read",
    "exports:read",
    "orders:read",
  ],
};

export function can(role: UserRole, permission: string) {
  return permissions[role].includes(permission);
}

export function getCurrentRole(): UserRole {
  const role = process.env.DEMO_USER_ROLE;
  return role === "user" ? "user" : "admin";
}
