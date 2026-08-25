import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { can } from "@/lib/auth/rbac";
import { getCompanyIdFromRequest, getRoleFromRequest } from "@/lib/auth/request-context";
import { supabaseAdmin } from "@/lib/supabase/admin-client";
import { normalizeUnitByCollectionType } from "@/lib/units";

const SELECT =
  "id,company_id,collection_id,collection_model_id,material_name,model_code,color_name,photo_url,quantity,quantity_m2,purchase_price_per_m2,sale_price_per_m2,low_stock_threshold,last_movement_at,unit,created_at,updated_at,collections(id,name,type),collection_models(id,model_code,color_name,image_url)";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type StockRow = Record<string, unknown> & {
  unit: "m2" | "meter" | "piece" | "pack";
  collections?: { type?: string | null } | null;
};

function shape(row: StockRow) {
  return {
    ...row,
    quantity_m2: Number(row.quantity_m2 ?? row.quantity ?? 0),
    purchase_price_per_m2: Number(row.purchase_price_per_m2 ?? 0),
    sale_price_per_m2: row.sale_price_per_m2 == null ? null : Number(row.sale_price_per_m2),
    low_stock_threshold: Number(row.low_stock_threshold ?? 10),
    unit: normalizeUnitByCollectionType(row.collections?.type, row.unit),
  };
}

/** Колонка barcode появляется отдельной миграцией — до неё поиск по коду просто пропускаем. */
function isMissingBarcodeColumn(message?: string) {
  return Boolean(message && message.toLowerCase().includes("barcode"));
}

/**
 * Поиск позиции по отсканированному коду:
 * 1. QR с нашей этикетки — внутри id позиции;
 * 2. привязанный ранее штрихкод поставщика;
 * 3. совпадение с кодом модели.
 */
export async function GET(request: NextRequest) {
  const role = getRoleFromRequest(request);
  if (!can(role, "stocks:read")) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const code = request.nextUrl.searchParams.get("code")?.trim();
  if (!code) {
    return NextResponse.json({ error: "Код не передан" }, { status: 400 });
  }

  const companyId = getCompanyIdFromRequest(request);

  if (UUID_RE.test(code)) {
    const { data } = await supabaseAdmin
      .from("stock_items")
      .select(SELECT)
      .eq("company_id", companyId)
      .eq("id", code)
      .maybeSingle();

    if (data) return NextResponse.json({ item: shape(data as unknown as StockRow), matchedBy: "qr" });
  }

  const byBarcode = await supabaseAdmin
    .from("stock_items")
    .select(SELECT)
    .eq("company_id", companyId)
    .eq("barcode", code)
    .maybeSingle();

  if (byBarcode.data) {
    return NextResponse.json({ item: shape(byBarcode.data as unknown as StockRow), matchedBy: "barcode" });
  }

  const barcodeUnavailable = isMissingBarcodeColumn(byBarcode.error?.message);

  const { data: byModel } = await supabaseAdmin
    .from("stock_items")
    .select(SELECT)
    .eq("company_id", companyId)
    .ilike("model_code", code)
    .limit(1)
    .maybeSingle();

  if (byModel) return NextResponse.json({ item: shape(byModel as unknown as StockRow), matchedBy: "model" });

  return NextResponse.json({ item: null, matchedBy: null, barcodeUnavailable });
}

const bindSchema = z.object({
  code: z.string().trim().min(1, "Код обязателен"),
  stock_item_id: z.string().uuid("Неверная позиция"),
});

/** Привязать отсканированный код к позиции, чтобы в следующий раз она находилась сразу. */
export async function POST(request: NextRequest) {
  const role = getRoleFromRequest(request);
  if (!can(role, "stocks:write")) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const parsed = bindSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Неверные данные" }, { status: 400 });
  }

  const companyId = getCompanyIdFromRequest(request);
  const { data, error } = await supabaseAdmin
    .from("stock_items")
    .update({ barcode: parsed.data.code })
    .eq("company_id", companyId)
    .eq("id", parsed.data.stock_item_id)
    .select(SELECT)
    .maybeSingle();

  if (error) {
    if (isMissingBarcodeColumn(error.message)) {
      return NextResponse.json(
        { error: "В базе ещё нет поля для кодов. Примените миграцию с колонкой barcode." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) return NextResponse.json({ error: "Позиция не найдена" }, { status: 404 });

  return NextResponse.json({ item: shape(data as unknown as StockRow) });
}
