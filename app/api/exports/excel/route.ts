import { NextRequest, NextResponse } from "next/server";
import { utils, write } from "xlsx";
import { getCompanyIdFromRequest, getRoleFromRequest } from "@/lib/auth/request-context";
import { can } from "@/lib/auth/rbac";
import { supabaseAdmin } from "@/lib/supabase/admin-client";
import { ExportSection, exportSectionLabel, exportSections } from "@/features/exports/lib/export-sections";

function isValidSection(value: string): value is ExportSection {
  return exportSections.some((item) => item.value === value);
}

function asDate(value: string | null) {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return value;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString("ru-RU");
}

export async function GET(request: NextRequest) {
  const role = getRoleFromRequest(request);
  if (!can(role, "exports:read")) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const sectionRaw = request.nextUrl.searchParams.get("section") ?? "catalog";
  if (!isValidSection(sectionRaw)) {
    return NextResponse.json({ error: "Неверный раздел выгрузки" }, { status: 400 });
  }

  const dateFrom = asDate(request.nextUrl.searchParams.get("date_from"));
  const dateTo = asDate(request.nextUrl.searchParams.get("date_to"));
  const companyId = getCompanyIdFromRequest(request);
  const section = sectionRaw as ExportSection;
  const sheetName = exportSectionLabel(section);
  const orderId = request.nextUrl.searchParams.get("order_id");
  const storeName = request.nextUrl.searchParams.get("store_name")?.trim();

  let rows: Record<string, unknown>[] = [];

  if (section === "catalog") {
    let query = supabaseAdmin
      .from("collections")
      .select("id,name,type,price_per_m2,created_at,updated_at,collection_models(model_code)")
      .eq("company_id", companyId)
      .order("name", { ascending: true });

    if (dateFrom) query = query.gte("created_at", dateFrom);
    if (dateTo) query = query.lte("created_at", dateTo);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    rows = (data ?? []).map((item) => ({
      ID: item.id,
      Название: item.name,
      Тип: item.type,
      "Цена за м²": Number(item.price_per_m2),
      Модели: (item.collection_models ?? []).map((model: { model_code: string }) => model.model_code).join(", "),
      Создано: formatDateTime(item.created_at),
      Обновлено: formatDateTime(item.updated_at),
    }));
  }

  if (section === "stocks") {
    const { data, error } = await supabaseAdmin
      .from("stock_items")
      .select("id,sku,material_name,model_code,color_name,quantity,quantity_m2,unit,purchase_price_per_m2,last_movement_at,created_at,updated_at,collections(name,type),collection_models(model_code)")
      .eq("company_id", companyId)
      .order("updated_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    rows = (data ?? []).map((item) => ({
      ID: item.id,
      SKU: (item as { sku?: string | null }).sku ?? "-",
      Материал: (item as { material_name?: string | null }).material_name ?? "-",
      Коллекция: (item.collections as { name?: string } | null)?.name ?? "-",
      Тип: (item.collections as { type?: string } | null)?.type ?? "-",
      Модель: (item.collection_models as { model_code?: string } | null)?.model_code ?? "-",
      Цвет: (item as { color_name?: string | null }).color_name ?? "-",
      Количество: Number((item as { quantity_m2?: number | null }).quantity_m2 ?? item.quantity),
      Единица: item.unit,
      "Закуп. цена": Number((item as { purchase_price_per_m2?: number | null }).purchase_price_per_m2 ?? 0),
      "Последнее движение": formatDateTime((item as { last_movement_at?: string | null }).last_movement_at),
      Создано: formatDateTime(item.created_at),
      Обновлено: formatDateTime(item.updated_at),
    }));
  }

  if (section === "movements") {
    let query = supabaseAdmin
      .from("stock_movements")
      .select("id,movement_type,quantity,quantity_m2,unit_price,total_amount,supplier_name,movement_date,comment,created_at,stock_items(unit,sku,material_name,color_name,collections(name),collection_models(model_code))")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (dateFrom) query = query.gte("created_at", dateFrom);
    if (dateTo) query = query.lte("created_at", dateTo);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    rows = (data ?? []).map((item) => {
      const stockItem = item.stock_items as
        | {
            unit?: string;
            collections?: { name?: string } | null;
            collection_models?: { model_code?: string } | null;
          }
        | null;

      return {
        ID: item.id,
        Дата: formatDateTime(item.created_at),
        "Дата движения": (item as { movement_date?: string | null }).movement_date ?? "-",
        Тип: item.movement_type,
        SKU: (stockItem as { sku?: string } | null)?.sku ?? "-",
        Материал: (stockItem as { material_name?: string } | null)?.material_name ?? "-",
        Коллекция: stockItem?.collections?.name ?? "-",
        Модель: stockItem?.collection_models?.model_code ?? "-",
        Цвет: (stockItem as { color_name?: string } | null)?.color_name ?? "-",
        Количество: Number((item as { quantity_m2?: number | null }).quantity_m2 ?? item.quantity),
        Единица: stockItem?.unit ?? "-",
        "Цена за м²": Number((item as { unit_price?: number | null }).unit_price ?? 0),
        Сумма: Number((item as { total_amount?: number | null }).total_amount ?? 0),
        Поставщик: (item as { supplier_name?: string | null }).supplier_name ?? "-",
        Комментарий: item.comment ?? "",
      };
    });
  }

  if (section === "stores") {
    const { data, error } = await supabaseAdmin
      .from("stores")
      .select("id,name,contact_person,phone,address,is_active,total_purchases_sum,total_paid_sum,current_debt_sum,last_activity_at,created_at")
      .eq("company_id", companyId)
      .order("name", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    rows = (data ?? []).map((item) => ({
      ID: item.id,
      Магазин: item.name,
      Контакт: item.contact_person ?? "-",
      Телефон: item.phone ?? "-",
      Адрес: item.address ?? "-",
      Статус: item.is_active ? "Активный" : "Неактивный",
      "Сумма закупок": Number(item.total_purchases_sum ?? 0),
      Оплачено: Number(item.total_paid_sum ?? 0),
      Долг: Number(item.current_debt_sum ?? 0),
      "Последняя активность": formatDateTime(item.last_activity_at),
      Создано: formatDateTime(item.created_at),
    }));
  }

  if (section === "purchases") {
    let query = supabaseAdmin
      .from("purchases")
      .select("id,purchase_number,purchase_date,total_amount,paid_amount,debt_amount,payment_status,comment,created_at,stores(name)")
      .eq("company_id", companyId)
      .order("purchase_date", { ascending: false });

    if (dateFrom) query = query.gte("purchase_date", dateFrom);
    if (dateTo) query = query.lte("purchase_date", dateTo);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    rows = (data ?? []).map((item) => ({
      ID: item.id,
      Номер: item.purchase_number,
      Магазин: (item.stores as { name?: string } | null)?.name ?? "-",
      Дата: item.purchase_date,
      Сумма: Number(item.total_amount),
      Оплачено: Number(item.paid_amount),
      Долг: Number(item.debt_amount),
      Статус: item.payment_status,
      Комментарий: item.comment ?? "",
      Создано: formatDateTime(item.created_at),
    }));
  }

  if (section === "payments") {
    let query = supabaseAdmin
      .from("payments")
      .select("id,amount,payment_date,payment_method,comment,created_at,stores(name),purchases(purchase_number)")
      .eq("company_id", companyId)
      .order("payment_date", { ascending: false });

    if (dateFrom) query = query.gte("payment_date", dateFrom);
    if (dateTo) query = query.lte("payment_date", dateTo);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    rows = (data ?? []).map((item) => ({
      ID: item.id,
      Дата: item.payment_date,
      Магазин: (item.stores as { name?: string } | null)?.name ?? "-",
      Закупка: (item.purchases as { purchase_number?: string } | null)?.purchase_number ?? "-",
      Сумма: Number(item.amount),
      Способ: item.payment_method,
      Комментарий: item.comment ?? "",
      Создано: formatDateTime(item.created_at),
    }));
  }

  if (section === "debts") {
    let query = supabaseAdmin
      .from("purchases")
      .select("id,purchase_number,purchase_date,debt_amount,payment_status,stores(name)")
      .eq("company_id", companyId)
      .gt("debt_amount", 0)
      .order("purchase_date", { ascending: false });

    if (dateFrom) query = query.gte("purchase_date", dateFrom);
    if (dateTo) query = query.lte("purchase_date", dateTo);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    rows = (data ?? []).map((item) => {
      const daysOverdue = Math.max(
        0,
        Math.floor((Date.now() - new Date(item.purchase_date).getTime()) / (1000 * 60 * 60 * 24))
      );
      const risk = daysOverdue <= 7 ? "Норма" : daysOverdue <= 30 ? "Внимание" : "Риск";

      return {
        ID: item.id,
        Магазин: (item.stores as { name?: string } | null)?.name ?? "-",
        Закупка: item.purchase_number,
        Дата: item.purchase_date,
        Долг: Number(item.debt_amount),
        Статус: item.payment_status,
        "Дней просрочки": daysOverdue,
        Риск: risk,
      };
    });
  }

  if (section === "orders") {
    let query = supabaseAdmin
      .from("orders")
      .select(
        "id,order_number,order_date,address,client_name,phone,total_amount,installation_amount,workshop_total,materials_cost_total,gross_profit,status,comment,order_items(material_name_snapshot,model_snapshot,color_snapshot,quantity_m2,unit,sale_price_per_m2,sale_amount)"
      )
      .eq("company_id", companyId)
      .order("order_date", { ascending: false });

    if (orderId) query = query.eq("id", orderId);
    if (dateFrom) query = query.gte("order_date", dateFrom);
    if (dateTo) query = query.lte("order_date", dateTo);
    if (storeName) query = query.eq("client_name", storeName);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const orders = (data ?? []) as Array<{
      id: string;
      order_number: string;
      order_date: string;
      client_name?: string | null;
      status: string;
      comment?: string | null;
      order_items?: Array<{
        material_name_snapshot?: string | null;
        model_snapshot?: string | null;
        color_snapshot?: string | null;
        quantity_m2?: number | null;
        unit?: string | null;
        sale_price_per_m2?: number | null;
        sale_amount?: number | null;
      }>;
    }>;

    const totalOrders = orders.length;
    let totalQuantity = 0;
    let totalAmount = 0;

    rows = orders.flatMap((order) => {
      const items = order.order_items ?? [];
      if (!items.length) {
        return [
          {
            "Номер заказа": order.order_number,
            "Дата заказа": order.order_date,
            "Клиент / Магазин": order.client_name ?? "-",
            "Товар / Материал": "-",
            Профиль: "-",
            Цвет: "-",
            Количество: 0,
            "Ед. изм.": "-",
            Цена: 0,
            Сумма: 0,
            "Статус заказа": order.status,
            Комментарий: order.comment ?? "",
          },
        ];
      }

      return items.map((item) => {
        const quantity = Number(item.quantity_m2 ?? 0);
        const price = Number(item.sale_price_per_m2 ?? 0);
        const amount = Number(item.sale_amount ?? quantity * price);
        totalQuantity += quantity;
        totalAmount += amount;

        return {
          "Номер заказа": order.order_number,
          "Дата заказа": order.order_date,
          "Клиент / Магазин": order.client_name ?? "-",
          "Товар / Материал": item.material_name_snapshot ?? "-",
          Профиль: item.model_snapshot ?? "-",
          Цвет: item.color_snapshot ?? "-",
          Количество: quantity,
          "Ед. изм.": item.unit ?? "m2",
          Цена: price,
          Сумма: amount,
          "Статус заказа": order.status,
          Комментарий: order.comment ?? "",
        };
      });
    });

    if (!orderId && rows.length) {
      rows.push({
        "Номер заказа": `ИТОГО заказов: ${totalOrders}`,
        "Дата заказа": "",
        "Клиент / Магазин": "",
        "Товар / Материал": "",
        Профиль: "",
        Цвет: "",
        Количество: totalQuantity,
        "Ед. изм.": "",
        Цена: "",
        Сумма: totalAmount,
        "Статус заказа": "",
        Комментарий: "",
      });
    }
  }

  const workbook = utils.book_new();
  const sheetData =
    rows.length > 0
      ? rows
      : [
          {
            Сообщение: section === "orders" ? "За выбранный период заказов нет" : "Нет данных за выбранный период",
            Раздел: sheetName,
          },
        ];
  const worksheet = utils.json_to_sheet(sheetData);
  utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));

  const fileBuffer = write(workbook, { type: "buffer", bookType: "xlsx" });
  const dateStamp = new Date().toISOString().slice(0, 10);
  const filename =
    section === "orders" && dateFrom && dateTo
      ? `orders_${dateFrom}_${dateTo}.xlsx`
      : `export-${section}-${dateStamp}.xlsx`;

  return new NextResponse(fileBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
