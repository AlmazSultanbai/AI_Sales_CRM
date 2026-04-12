import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

function normalizeText(value?: string | null) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await request.json()) as {
    shop_name?: string;
    owner_name?: string | null;
    phone?: string | null;
    debt_amount?: number;
    note?: string | null;
    is_active?: boolean;
  };

  const updates: Record<string, unknown> = {};

  if (body.shop_name !== undefined) {
    const shopName = normalizeText(body.shop_name);
    if (!shopName) {
      return NextResponse.json({ error: "Название магазина обязательно" }, { status: 400 });
    }
    updates.shop_name = shopName;
  }

  if (body.owner_name !== undefined) {
    updates.owner_name = normalizeText(body.owner_name);
  }

  if (body.phone !== undefined) {
    updates.phone = normalizeText(body.phone);
  }

  if (body.note !== undefined) {
    updates.note = normalizeText(body.note);
  }

  if (body.debt_amount !== undefined) {
    const debtAmount = Number(body.debt_amount);
    if (Number.isNaN(debtAmount) || debtAmount < 0) {
      return NextResponse.json({ error: "Сумма долга должна быть 0 или больше" }, { status: 400 });
    }
    updates.debt_amount = debtAmount;
  }

  if (body.is_active !== undefined) {
    updates.is_active = Boolean(body.is_active);
  }

  const { data, error } = await supabaseAdmin
    .from("store_debts")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
