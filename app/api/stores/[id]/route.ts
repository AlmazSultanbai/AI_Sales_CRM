import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin-client";
import { getCompanyIdFromRequest, getRoleFromRequest } from "@/lib/auth/request-context";
import { can } from "@/lib/auth/rbac";
import { updateStoreSchema } from "@/features/stores/lib/schemas";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const companyId = getCompanyIdFromRequest(request);

  const { data, error } = await supabaseAdmin
    .from("stores")
    .select("*")
    .eq("id", id)
    .eq("company_id", companyId)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const role = getRoleFromRequest(request);
  if (!can(role, "stores:write")) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const parsed = updateStoreSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ошибка валидации" }, { status: 400 });
  }

  const { id } = await params;
  const companyId = getCompanyIdFromRequest(request);

  const payload = {
    ...parsed.data,
    contact_person: parsed.data.contact_person || null,
    phone: parsed.data.phone || null,
    address: parsed.data.address || null,
    notes: parsed.data.notes || null,
  };

  const { data, error } = await supabaseAdmin
    .from("stores")
    .update(payload)
    .eq("id", id)
    .eq("company_id", companyId)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const role = getRoleFromRequest(request);
  if (!can(role, "stores:write")) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const { id } = await params;
  const companyId = getCompanyIdFromRequest(request);
  const userEmail = request.headers.get("x-user-email");

  const deleteSchema = z.object({
    password: z.string().min(1, "Укажите пароль"),
  });

  const parsed = deleteSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Пароль обязателен" }, { status: 400 });
  }

  if (!userEmail) {
    return NextResponse.json({ error: "Не удалось определить пользователя" }, { status: 401 });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Auth не настроен" }, { status: 500 });
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });

  const { error: authError } = await authClient.auth.signInWithPassword({
    email: userEmail,
    password: parsed.data.password,
  });

  if (authError) {
    return NextResponse.json({ error: "Неверный пароль" }, { status: 401 });
  }

  const { error } = await supabaseAdmin
    .from("stores")
    .update({ is_active: false })
    .eq("id", id)
    .eq("company_id", companyId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
