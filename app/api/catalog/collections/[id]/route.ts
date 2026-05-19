import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin-client";
import { can } from "@/lib/auth/rbac";
import { getCompanyIdFromRequest, getRoleFromRequest } from "@/lib/auth/request-context";
import { updateCollectionSchema } from "@/features/catalog/lib/schemas";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const role = getRoleFromRequest(request);
  if (!can(role, "catalog:write")) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const parsed = updateCollectionSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ошибка валидации" }, { status: 400 });
  }

  const { id } = await params;
  const companyId = getCompanyIdFromRequest(request);

  const { data, error } = await supabaseAdmin
    .from("collections")
    .update(parsed.data)
    .eq("id", id)
    .eq("company_id", companyId)
    .select(
      "id,name,type,price_per_m2,image_url,company_id,created_at,updated_at,collection_models(id,collection_id,model_code,color_name,color_hex,price_per_m2,image_url,sku,is_active,sort_order,created_at,stock_items(quantity,unit))"
    )
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

  const { data: models } = await supabaseAdmin
    .from("collection_models")
    .select("id")
    .eq("collection_id", id);

  const modelIds = (models ?? []).map((model) => model.id);

  const { data: collectionMedia } = await supabaseAdmin
    .from("media_files")
    .select("id,file_path")
    .eq("company_id", companyId)
    .eq("entity_type", "collection")
    .eq("entity_id", id);

  let modelMedia: { id: string; file_path: string }[] = [];
  if (modelIds.length) {
    const { data } = await supabaseAdmin
      .from("media_files")
      .select("id,file_path")
      .eq("company_id", companyId)
      .eq("entity_type", "collection_model")
      .in("entity_id", modelIds);
    modelMedia = data ?? [];
  }

  const mediaFiles = [...(collectionMedia ?? []), ...modelMedia];

  if (mediaFiles?.length) {
    await supabaseAdmin.storage.from("product-images").remove(mediaFiles.map((item) => item.file_path));
    await supabaseAdmin.from("media_files").delete().in("id", mediaFiles.map((item) => item.id));
  }

  const { error } = await supabaseAdmin
    .from("collections")
    .delete()
    .eq("id", id)
    .eq("company_id", companyId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
