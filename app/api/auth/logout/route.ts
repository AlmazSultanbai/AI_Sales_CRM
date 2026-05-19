import { NextResponse } from "next/server";
import { AUTH_ACCESS_COOKIE, AUTH_PROFILE_COOKIE, AUTH_REFRESH_COOKIE } from "@/lib/auth/session";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_ACCESS_COOKIE, "", { path: "/", maxAge: 0 });
  response.cookies.set(AUTH_REFRESH_COOKIE, "", { path: "/", maxAge: 0 });
  response.cookies.set(AUTH_PROFILE_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
