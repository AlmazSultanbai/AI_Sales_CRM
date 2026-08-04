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

function paymentStatusLabel(status: string | null | undefined, paidAmount: number, totalAmount: number) {
  if (totalAmount > 0 && paidAmount >= totalAmount) return "Оплачен";
  if (paidAmount <= 0) return "Не оплачен";
  return paidAmount / totalAmount <= 0.5 ? "Оплачено до 50%" : "Оплачено более 50%";
}

function paymentStatusStyle(statusLabel: string) {
  if (statusLabel === "Оплачен") {
    return { fill: { fgColor: { rgb: "DCFCE7" } }, font: { color: { rgb: "166534" }, bold: true } };
  }
  if (statusLabel === "Оплачено более 50%") {
    return { fill: { fgColor: { rgb: "FEF3C7" } }, font: { color: { rgb: "B45309" }, bold: true } };
  }
  return { fill: { fgColor: { rgb: "FEE2E2" } }, font: { color: { rgb: "B91C1C" }, bold: true } };
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
      .select("id,material_name,model_code,color_name,quantity,quantity_m2,unit,purchase_price_per_m2,last_movement_at,created_at,updated_at,collections(name,type),collection_models(model_code)")
      .eq("company_id", companyId)
      .order("updated_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    rows = (data ?? []).map((item) => ({
      ID: item.id,
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
      .select("id,movement_type,quantity,quantity_m2,unit_price,total_amount,supplier_name,movement_date,comment,created_at,stock_items(unit,material_name,color_name,collections(name),collection_models(model_code))")
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
      Адрес: item.address ?? "-",
      Контакт: item.contact_person ?? "-",
      Телефон: item.phone ?? "-",
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
        "id,order_number,order_date,address,client_name,phone,total_amount,paid_amount,debt_amount,payment_status,installation_amount,workshop_total,materials_cost_total,gross_profit,status,comment,order_items(material_name_snapshot,model_snapshot,color_snapshot,quantity_m2,unit,sale_price_per_m2,sale_amount)"
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
      address?: string | null;
      phone?: string | null;
      total_amount?: number | null;
      paid_amount?: number | null;
      debt_amount?: number | null;
      payment_status?: string | null;
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
    let totalLineAmount = 0;
    let totalOrderAmount = 0;
    let totalPaidAmount = 0;
    let totalDebtAmount = 0;

    rows = orders.flatMap((order) => {
      const items = order.order_items ?? [];
      const orderAmount = Number(order.total_amount ?? 0);
      const paidAmount = Number(order.paid_amount ?? 0);
      const debtAmount = Number(order.debt_amount ?? Math.max(orderAmount - paidAmount, 0));
      const orderPaymentStatus = paymentStatusLabel(order.payment_status, paidAmount, orderAmount);
      totalOrderAmount += orderAmount;
      totalPaidAmount += paidAmount;
      totalDebtAmount += debtAmount;

      if (!items.length) {
        return [
          {
            "Номер заказа": order.order_number,
            "Дата заказа": order.order_date,
            "Клиент / Магазин": order.client_name ?? "-",
            Адрес: order.address ?? "-",
            Телефон: order.phone ?? "-",
            "Товар / Материал": "-",
            Профиль: "-",
            Цвет: "-",
            Количество: 0,
            "Ед. изм.": "-",
            Цена: 0,
            Сумма: 0,
            "Общая сумма": orderAmount,
            Оплачено: paidAmount,
            Долг: debtAmount,
            "Статус оплаты": orderPaymentStatus,
            "Статус заказа": order.status,
            Комментарий: order.comment ?? "",
          },
        ];
      }

      return items.map((item, itemIndex) => {
        const quantity = Number(item.quantity_m2 ?? 0);
        const price = Number(item.sale_price_per_m2 ?? 0);
        const amount = Number(item.sale_amount ?? quantity * price);
        totalQuantity += quantity;
        totalLineAmount += amount;

        return {
          "Номер заказа": order.order_number,
          "Дата заказа": order.order_date,
          "Клиент / Магазин": order.client_name ?? "-",
          Адрес: order.address ?? "-",
          Телефон: order.phone ?? "-",
          "Товар / Материал": item.material_name_snapshot ?? "-",
          Профиль: item.model_snapshot ?? "-",
          Цвет: item.color_snapshot ?? "-",
          Количество: quantity,
          "Ед. изм.": item.unit ?? "m2",
          Цена: price,
          Сумма: amount,
          "Общая сумма": itemIndex === 0 ? orderAmount : "",
          Оплачено: itemIndex === 0 ? paidAmount : "",
          Долг: itemIndex === 0 ? debtAmount : "",
          "Статус оплаты": itemIndex === 0 ? orderPaymentStatus : "",
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
        Адрес: "",
        Телефон: "",
        "Товар / Материал": "",
        Профиль: "",
        Цвет: "",
        Количество: totalQuantity,
        "Ед. изм.": "",
        Цена: "",
        Сумма: totalLineAmount,
        "Общая сумма": totalOrderAmount,
        Оплачено: totalPaidAmount,
        Долг: totalDebtAmount,
        "Статус оплаты": "",
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
  if (section === "orders" && rows.length) {
    const statusColumn = Object.keys(rows[0]).indexOf("Статус оплаты");
    if (statusColumn >= 0) {
      for (let row = 1; row <= rows.length; row += 1) {
        const cell = worksheet[utils.encode_cell({ r: row, c: statusColumn })] as { v?: unknown; s?: unknown } | undefined;
        if (cell?.v) cell.s = paymentStatusStyle(String(cell.v));
      }
    }
  }
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
