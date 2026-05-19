import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin-client";
import { can } from "@/lib/auth/rbac";
import { getRoleFromRequest } from "@/lib/auth/request-context";
import { createModelSchema } from "@/features/catalog/lib/schemas";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const role = getRoleFromRequest(request);
  if (!can(role, "catalog:write")) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const parsed = createModelSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ошибка валидации" }, { status: 400 });
  }

  const { id: collectionId } = await params;

  const { data: collection } = await supabaseAdmin
    .from("collections")
    .select("price_per_m2")
    .eq("id", collectionId)
    .single();

  const { data, error } = await supabaseAdmin
    .from("collection_models")
    .insert({
      collection_id: collectionId,
      model_code: parsed.data.model_code,
      color_name: parsed.data.color_name,
      color_hex: parsed.data.color_hex,
      price_per_m2: parsed.data.price_per_m2 ?? Number(collection?.price_per_m2 ?? 0),
      sku: parsed.data.sku || null,
      sort_order: parsed.data.sort_order ?? 0,
      is_active: true,
    })
    .select("id,collection_id,model_code,color_name,color_hex,price_per_m2,image_url,sku,is_active,sort_order,created_at,stock_items(quantity,unit)")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
