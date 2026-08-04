import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin-client";
import { can } from "@/lib/auth/rbac";
import { getCompanyIdFromRequest, getRoleFromRequest } from "@/lib/auth/request-context";
import { updateModelSchema } from "@/features/catalog/lib/schemas";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const role = getRoleFromRequest(request);
  if (!can(role, "catalog:write")) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const parsed = updateModelSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ошибка валидации" }, { status: 400 });
  }

  const { id } = await params;
  const { data, error } = await supabaseAdmin
    .from("collection_models")
    .update(parsed.data)
    .eq("id", id)
    .select("id,collection_id,model_code,color_name,price_per_m2,image_url,is_active,created_at,stock_items(quantity,unit)")
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
  if (!can(role, "catalog:write")) {
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

  const { data: targetModel, error: modelError } = await supabaseAdmin
    .from("collection_models")
    .select("id,collection_id,collections!inner(company_id)")
    .eq("id", id)
    .eq("collections.company_id", companyId)
    .single();

  if (modelError || !targetModel) {
    return NextResponse.json({ error: "Модель не найдена" }, { status: 404 });
  }

  const { data: mediaFiles } = await supabaseAdmin
    .from("media_files")
    .select("id,file_path")
    .eq("entity_type", "collection_model")
    .eq("entity_id", id);

  if (mediaFiles?.length) {
    await supabaseAdmin.storage.from("product-images").remove(mediaFiles.map((item) => item.file_path));
    await supabaseAdmin.from("media_files").delete().in("id", mediaFiles.map((item) => item.id));
  }

  const { error } = await supabaseAdmin
    .from("collection_models")
    .delete()
    .eq("id", id)
    .eq("collection_id", targetModel.collection_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
