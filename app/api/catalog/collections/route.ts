import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin-client";
import { can } from "@/lib/auth/rbac";
import { getCompanyIdFromRequest, getRoleFromRequest } from "@/lib/auth/request-context";
import { createCollectionSchema } from "@/features/catalog/lib/schemas";

export async function GET(request: NextRequest) {
  const companyId = getCompanyIdFromRequest(request);
  const search = request.nextUrl.searchParams.get("search")?.trim() ?? "";
  const type = request.nextUrl.searchParams.get("type")?.trim() ?? "all";

  let query = supabaseAdmin
    .from("collections")
    .select(
      "id,name,type,price_per_m2,image_url,company_id,created_at,updated_at,collection_models(id,collection_id,model_code,color_name,color_hex,price_per_m2,image_url,sku,is_active,sort_order,created_at,stock_items(quantity,unit))"
    )
    .eq("company_id", companyId)
    .order("name", { ascending: true });

  if (type && type !== "all") {
    query = query.eq("type", type);
  }

  if (search.length > 0) {
    query = query.ilike("name", `%${search}%`);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const role = getRoleFromRequest(request);
  if (!can(role, "catalog:write")) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const parsed = createCollectionSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ошибка валидации" }, { status: 400 });
  }

  const companyId = getCompanyIdFromRequest(request);

  const { data, error } = await supabaseAdmin
    .from("collections")
    .insert({
      company_id: companyId,
      name: parsed.data.name,
      type: parsed.data.type,
      price_per_m2: parsed.data.price_per_m2,
    })
    .select(
      "id,name,type,price_per_m2,image_url,company_id,created_at,updated_at,collection_models(id,collection_id,model_code,color_name,color_hex,price_per_m2,image_url,sku,is_active,sort_order,created_at,stock_items(quantity,unit))"
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
