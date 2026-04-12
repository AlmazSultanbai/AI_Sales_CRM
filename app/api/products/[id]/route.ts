import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { allowedUnits } from "@/lib/product-utils";
import { ProductCategory, UnitType } from "@/lib/types";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await request.json()) as {
    category?: ProductCategory;
    price?: number;
    stock?: number;
    unit?: UnitType;
    is_active?: boolean;
  };

  const updates: Record<string, unknown> = {};

  if (body.price !== undefined) {
    const price = Number(body.price);

    if (Number.isNaN(price) || price < 0) {
      return NextResponse.json({ error: "Цена должна быть 0 или больше" }, { status: 400 });
    }

    updates.price = price;
  }

  if (body.stock !== undefined) {
    const stock = Number(body.stock);

    if (Number.isNaN(stock) || stock < 0) {
      return NextResponse.json({ error: "Остаток должен быть 0 или больше" }, { status: 400 });
    }

    updates.stock = stock;
  }

  if (body.unit !== undefined) {
    if (!body.category || !allowedUnits(body.category).includes(body.unit)) {
      return NextResponse.json(
        { error: "Неверная единица измерения для этой категории" },
        { status: 400 }
      );
    }

    updates.unit = body.unit;
  }

  if (body.is_active !== undefined) {
    updates.is_active = Boolean(body.is_active);
  }

  const { data, error } = await supabaseAdmin
    .from("products")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
