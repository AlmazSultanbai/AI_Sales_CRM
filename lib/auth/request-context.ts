import { NextRequest } from "next/server";
import { UserRole } from "@/types/domain";

export function getRoleFromRequest(request: NextRequest): UserRole {
  const explicitRole = request.headers.get("x-user-role");
  if (explicitRole === "admin" || explicitRole === "user") {
    return explicitRole;
  }

  return process.env.DEMO_USER_ROLE === "user" ? "user" : "admin";
}

export function getCompanyIdFromRequest(_request: NextRequest): string {
  const fromHeader = _request.headers.get("x-company-id");
  if (fromHeader) return fromHeader;
  return process.env.DEMO_COMPANY_ID ?? "00000000-0000-0000-0000-000000000001";
}

export function getUserIdFromRequest(request: NextRequest): string | null {
  return request.headers.get("x-user-id");
}
