import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AUTH_ACCESS_COOKIE, AUTH_COOKIE_MAX_AGE_SECONDS, AUTH_PROFILE_COOKIE, AUTH_REFRESH_COOKIE } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin-client";

const loginSchema = z.object({
  email: z.string().trim().min(1, "Укажите email или логин"),
  password: z.string().min(1, "Укажите пароль"),
});

function normalizeLoginToEmail(value: string) {
  const login = value.trim().toLowerCase();
  if (login.includes("@")) return login;
  return `${login}@sun-textile.local`;
}

export async function POST(request: NextRequest) {
  const parsed = loginSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Неверные данные" }, { status: 400 });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Supabase Auth не настроен" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizeLoginToEmail(parsed.data.email),
    password: parsed.data.password,
  });

  if (error || !data.session) {
    return NextResponse.json({ error: "Неверный логин или пароль" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_ACCESS_COOKIE, data.session.access_token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: AUTH_COOKIE_MAX_AGE_SECONDS,
  });
  response.cookies.set(AUTH_REFRESH_COOKIE, data.session.refresh_token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: AUTH_COOKIE_MAX_AGE_SECONDS,
  });

  const { data: profile } = await supabaseAdmin
    .from("users")
    .select("company_id,role")
    .eq("id", data.user.id)
    .maybeSingle();

  response.cookies.set(
    AUTH_PROFILE_COOKIE,
    JSON.stringify({
      user_id: data.user.id,
      role: profile?.role ?? null,
      company_id: profile?.company_id ?? null,
    }),
    {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: AUTH_COOKIE_MAX_AGE_SECONDS,
    }
  );

  return response;
}
