import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { StoreDebtPayload } from "@/lib/types";

function normalizeText(value?: string | null) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("store_debts")
    .select("*")
    .order("is_active", { ascending: false })
    .order("debt_amount", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Partial<StoreDebtPayload>;

  if (!normalizeText(body.shop_name)) {
    return NextResponse.json({ error: "Название магазина обязательно" }, { status: 400 });
  }

  const debtAmount = Number(body.debt_amount);
  if (Number.isNaN(debtAmount) || debtAmount < 0) {
    return NextResponse.json({ error: "Сумма долга должна быть 0 или больше" }, { status: 400 });
  }

  const payload = {
    shop_name: normalizeText(body.shop_name),
    owner_name: normalizeText(body.owner_name),
    phone: normalizeText(body.phone),
    debt_amount: debtAmount,
    note: normalizeText(body.note),
  };

  const { data, error } = await supabaseAdmin
    .from("store_debts")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
