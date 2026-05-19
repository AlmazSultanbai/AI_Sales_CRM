import { NextRequest, NextResponse } from "next/server";
import {
  AUTH_ACCESS_COOKIE,
  AUTH_COOKIE_MAX_AGE_SECONDS,
  AUTH_PROFILE_COOKIE,
  AUTH_REFRESH_COOKIE,
} from "@/lib/auth/session";

const PUBLIC_PATHS = ["/login"];
const PROTECTED_PREFIXES = [
  "/catalog",
  "/stores",
  "/movements",
  "/stocks",
  "/orders",
  "/reports",
  "/settings",
  "/exports",
  "/excel-export",
  "/debts",
];

function isApiPath(pathname: string) {
  return pathname.startsWith("/api/");
}

function isProtectedUiPath(pathname: string) {
  if (pathname === "/") return true;
  return PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.includes(pathname);
}

async function getSupabaseUser(accessToken: string) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return null;

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) return null;
  return (await response.json()) as { id: string; email?: string | null };
}

async function refreshSupabaseSession(refreshToken: string) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return null;

  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: {
      apikey: supabaseAnonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
    cache: "no-store",
  });

  if (!response.ok) return null;
  return (await response.json()) as {
    access_token: string;
    refresh_token: string;
  };
}

async function getUserProfile(userId: string) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;

  const response = await fetch(
    `${supabaseUrl}/rest/v1/users?id=eq.${encodeURIComponent(userId)}&select=company_id,role&limit=1`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      cache: "no-store",
    }
  );

  if (!response.ok) return null;
  const rows = (await response.json()) as Array<{ company_id: string | null; role: string | null }>;
  return rows[0] ?? null;
}

type ProfilePayload = {
  user_id: string;
  role: string | null;
  company_id: string | null;
};

function readProfileCookie(rawValue?: string) {
  if (!rawValue) return null;
  try {
    const parsed = JSON.parse(rawValue) as ProfilePayload;
    if (!parsed.user_id) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeAuthCookies(response: NextResponse, payload: { access_token: string; refresh_token: string }) {
  response.cookies.set(AUTH_ACCESS_COOKIE, payload.access_token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: AUTH_COOKIE_MAX_AGE_SECONDS,
  });
  response.cookies.set(AUTH_REFRESH_COOKIE, payload.refresh_token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: AUTH_COOKIE_MAX_AGE_SECONDS,
  });
}

function writeProfileCookie(response: NextResponse, profile: ProfilePayload) {
  response.cookies.set(AUTH_PROFILE_COOKIE, JSON.stringify(profile), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: AUTH_COOKIE_MAX_AGE_SECONDS,
  });
}

function unauthorizedResponse(request: NextRequest) {
  if (isApiPath(request.nextUrl.pathname)) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }
  const redirectUrl = new URL("/login", request.url);
  redirectUrl.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(redirectUrl);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/public") ||
    pathname.match(/\.(?:png|jpg|jpeg|svg|webp|gif|ico|css|js|map)$/)
  ) {
    return NextResponse.next();
  }

  const shouldProtect = isProtectedUiPath(pathname) || (isApiPath(pathname) && !pathname.startsWith("/api/auth/"));
  if (!shouldProtect && !isPublicPath(pathname)) {
    return NextResponse.next();
  }

  let accessToken = request.cookies.get(AUTH_ACCESS_COOKIE)?.value;
  const refreshToken = request.cookies.get(AUTH_REFRESH_COOKIE)?.value;
  let refreshedSession: { access_token: string; refresh_token: string } | null = null;

  let user = accessToken ? await getSupabaseUser(accessToken) : null;

  if (!user && refreshToken) {
    const refreshed = await refreshSupabaseSession(refreshToken);
    if (refreshed) {
      accessToken = refreshed.access_token;
      refreshedSession = refreshed;
      user = await getSupabaseUser(refreshed.access_token);
    }
  }

  if (!user) {
    if (isPublicPath(pathname)) {
      return NextResponse.next();
    }
    const response = unauthorizedResponse(request);
    response.cookies.set(AUTH_ACCESS_COOKIE, "", { path: "/", maxAge: 0 });
    response.cookies.set(AUTH_REFRESH_COOKIE, "", { path: "/", maxAge: 0 });
    response.cookies.set(AUTH_PROFILE_COOKIE, "", { path: "/", maxAge: 0 });
    return response;
  }

  const profileFromCookie = readProfileCookie(request.cookies.get(AUTH_PROFILE_COOKIE)?.value);
  let resolvedProfile =
    profileFromCookie && profileFromCookie.user_id === user.id
      ? profileFromCookie
      : null;

  if (!resolvedProfile) {
    const profile = await getUserProfile(user.id);
    resolvedProfile = {
      user_id: user.id,
      role: profile?.role ?? null,
      company_id: profile?.company_id ?? null,
    };
  }

  if (isPublicPath(pathname)) {
    const response = NextResponse.redirect(new URL("/stocks", request.url));
    if (refreshedSession) {
      writeAuthCookies(response, refreshedSession);
    }
    if (!profileFromCookie || profileFromCookie.user_id !== user.id) {
      writeProfileCookie(response, resolvedProfile);
    }
    return response;
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-user-id", user.id);
  requestHeaders.set("x-user-email", user.email ?? "");

  if (resolvedProfile.role) requestHeaders.set("x-user-role", resolvedProfile.role);
  if (resolvedProfile.company_id) requestHeaders.set("x-company-id", resolvedProfile.company_id);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  if (refreshedSession) {
    writeAuthCookies(response, refreshedSession);
  }
  if (!profileFromCookie || profileFromCookie.user_id !== user.id) {
    writeProfileCookie(response, resolvedProfile);
  }
  return response;
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/catalog/:path*",
    "/stores/:path*",
    "/movements/:path*",
    "/stocks/:path*",
    "/orders/:path*",
    "/reports/:path*",
    "/settings/:path*",
    "/exports/:path*",
    "/excel-export/:path*",
    "/debts/:path*",
    "/api/:path*",
  ],
};
