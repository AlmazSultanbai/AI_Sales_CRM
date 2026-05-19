import { z } from "zod";

export const orderStatusSchema = z.enum(["draft", "confirmed", "completed", "cancelled"]);
export const orderStatusFilterSchema = z.enum(["all", "draft", "confirmed", "completed", "cancelled"]).default("all");

export const orderItemSchema = z.object({
  id: z.string().uuid().optional(),
  stock_item_id: z.string().uuid().nullable().optional(),
  collection_id: z.string().uuid().nullable().optional(),
  collection_model_id: z.string().uuid().nullable().optional(),
  material_name_snapshot: z.string().trim().min(1, "Укажите материал"),
  model_snapshot: z.string().trim().nullable().optional(),
  color_snapshot: z.string().trim().nullable().optional(),
  sku_snapshot: z.string().trim().nullable().optional(),
  unit: z.enum(["m2", "meter", "piece", "pack"]).default("m2"),
  quantity_m2: z.coerce.number().positive("Количество должно быть больше 0"),
  sale_price_per_m2: z.coerce.number().nonnegative("Цена продажи должна быть 0 или больше"),
  cost_price_per_m2: z.coerce.number().nonnegative("Себестоимость должна быть 0 или больше"),
});

export const createOrderSchema = z.object({
  order_date: z.string().min(1, "Укажите дату"),
  address: z.string().trim().min(2, "Укажите адрес"),
  client_name: z.string().trim().min(1, "Укажите клиента"),
  phone: z.string().trim().nullable().optional(),
  total_amount: z.coerce.number().nonnegative().nullable().optional(),
  installation_amount: z.coerce.number().nonnegative().default(0),
  workshop_total: z.coerce.number().nonnegative().nullable().optional(),
  comment: z.string().trim().nullable().optional(),
  status: orderStatusSchema.default("draft"),
  items: z.array(orderItemSchema).min(1, "Добавьте хотя бы один материал"),
});

export const updateOrderSchema = createOrderSchema.partial().extend({
  order_number: z.string().trim().optional(),
  status: orderStatusSchema.optional(),
  items: z.array(orderItemSchema).optional(),
});

export const orderListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
  status: orderStatusFilterSchema,
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  search: z.string().trim().optional(),
  client: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  address: z.string().trim().optional(),
  material: z.string().trim().optional(),
  user: z.string().trim().optional(),
});

export type OrderStatus = z.infer<typeof orderStatusSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
