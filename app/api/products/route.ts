import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { buildTitle, normalizeText, validateNewProduct } from "@/lib/product-utils";
import { ProductPayload } from "@/lib/types";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("products")
    .select("*")
    .order("category", { ascending: true })
    .order("title", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Partial<ProductPayload>;
  const validationError = validateNewProduct(body);

  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const payload = {
    category: body.category!,
    collection_name: normalizeText(body.collection_name),
    model: normalizeText(body.model),
    color: normalizeText(body.color),
    price: Number(body.price),
    unit: body.unit!,
    stock: Number(body.stock),
    title: buildTitle({
      category: body.category!,
      collection_name: body.collection_name,
      model: body.model,
      color: body.color,
    }),
  };

  const { data, error } = await supabaseAdmin
    .from("products")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
