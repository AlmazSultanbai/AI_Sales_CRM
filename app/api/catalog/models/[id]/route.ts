import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin-client";
import { can } from "@/lib/auth/rbac";
import { getRoleFromRequest } from "@/lib/auth/request-context";
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
    .select("id,collection_id,model_code,color_name,color_hex,price_per_m2,image_url,sku,is_active,sort_order,created_at,stock_items(quantity,unit)")
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

  const { data: mediaFiles } = await supabaseAdmin
    .from("media_files")
    .select("id,file_path")
    .eq("entity_type", "collection_model")
    .eq("entity_id", id);

  if (mediaFiles?.length) {
    await supabaseAdmin.storage.from("product-images").remove(mediaFiles.map((item) => item.file_path));
    await supabaseAdmin.from("media_files").delete().in("id", mediaFiles.map((item) => item.id));
  }

  const { error } = await supabaseAdmin.from("collection_models").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
