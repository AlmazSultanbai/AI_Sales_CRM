import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin-client";
import { getCompanyIdFromRequest, getRoleFromRequest } from "@/lib/auth/request-context";
import { can } from "@/lib/auth/rbac";
import { createStoreSchema, storeFilterSchema, storeSortSchema } from "@/features/stores/lib/schemas";
import { applyStoreTotals, loadStoreTotalsIndex, pickStoreTotals } from "@/lib/supabase/store-orders-summary";

export async function GET(request: NextRequest) {
  const companyId = getCompanyIdFromRequest(request);
  const search = request.nextUrl.searchParams.get("search")?.trim() ?? "";
  const filter = storeFilterSchema.parse(request.nextUrl.searchParams.get("filter") ?? "all");
  const sort = storeSortSchema.parse(request.nextUrl.searchParams.get("sort") ?? "name");

  let query = supabaseAdmin
    .from("stores")
    .select("id,name,contact_person,phone,address,notes,debt_balance,is_active,total_purchases_sum,total_paid_sum,current_debt_sum,last_activity_at,created_at,updated_at")
    .eq("company_id", companyId);

  if (search) {
    query = query.or(`name.ilike.%${search}%,contact_person.ilike.%${search}%`);
  }

  query = filter === "inactive" ? query.eq("is_active", false) : query.eq("is_active", true);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Долг и обороты магазина считаем по его заказам, а не по пустым закупкам,
  // поэтому фильтр по долгу и сортировку применяем уже после расчёта.
  let totalsIndex;
  try {
    totalsIndex = await loadStoreTotalsIndex(companyId);
  } catch (totalsError) {
    return NextResponse.json(
      { error: totalsError instanceof Error ? totalsError.message : "Не удалось посчитать долги магазинов" },
      { status: 500 }
    );
  }

  let stores = (data ?? []).map((store) => applyStoreTotals(store, pickStoreTotals(totalsIndex, store)));

  if (filter === "with_debt") stores = stores.filter((store) => Number(store.current_debt_sum) > 0);
  if (filter === "without_debt") stores = stores.filter((store) => Number(store.current_debt_sum) <= 0);

  if (sort === "name") {
    stores.sort((a, b) => String(a.name).localeCompare(String(b.name), "ru"));
  }
  if (sort === "debt") {
    stores.sort((a, b) => Number(b.current_debt_sum) - Number(a.current_debt_sum));
  }
  if (sort === "activity") {
    stores.sort((a, b) => String(b.last_activity_at ?? "").localeCompare(String(a.last_activity_at ?? "")));
  }

  return NextResponse.json(stores);
}

export async function POST(request: NextRequest) {
  const role = getRoleFromRequest(request);
  if (!can(role, "stores:write")) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const parsed = createStoreSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ошибка валидации" }, { status: 400 });
  }

  const companyId = getCompanyIdFromRequest(request);
  const payload = {
    company_id: companyId,
    name: parsed.data.name,
    contact_person: parsed.data.contact_person || null,
    phone: parsed.data.phone || null,
    address: parsed.data.address || null,
    notes: parsed.data.notes || null,
    is_active: true,
  };

  const { data, error } = await supabaseAdmin.from("stores").insert(payload).select("*").single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
