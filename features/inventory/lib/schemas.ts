import { z } from "zod";

export const stockInStockFilterSchema = z.enum(["all", "in_stock", "out_of_stock"]).default("all");
export const stockMovementTypeSchema = z.enum(["incoming", "outgoing", "transfer", "adjustment"]);

export const stockListQuerySchema = z.object({
  search: z.string().trim().optional(),
  material: z.string().trim().optional(),
  collection_id: z.string().uuid().optional(),
  model_id: z.string().uuid().optional(),
  color: z.string().trim().optional(),
  low_stock: z.enum(["true", "false"]).optional(),
  in_stock: stockInStockFilterSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(8),
});

export const createStockMovementSchema = z.object({
  stock_item_id: z.string().uuid().optional().nullable(),
  collection_id: z.string().uuid().optional().nullable(),
  collection_model_id: z.string().uuid().optional().nullable(),
  material_name: z.string().trim().optional().nullable(),
  model_code: z.string().trim().optional().nullable(),
  color_name: z.string().trim().optional().nullable(),
  photo_url: z.string().url().optional().nullable(),
  movement_type: stockMovementTypeSchema,
  supplier_name: z.string().trim().optional().nullable(),
  source_store_id: z.string().uuid().optional().nullable(),
  destination_store_id: z.string().uuid().optional().nullable(),
  movement_date: z.string().min(1, "Дата обязательна"),
  quantity_m2: z.coerce.number(),
  unit_price: z.coerce.number().min(0, "Цена закупки должна быть >= 0").default(0),
  sale_price_per_m2: z.coerce.number().min(0, "Цена продажи должна быть >= 0").optional().nullable(),
  low_stock_threshold: z.coerce.number().min(0).optional(),
  password: z.string().optional(),
  comment: z.string().trim().optional().nullable(),
}).superRefine((data, ctx) => {
  if (data.movement_type === "adjustment") {
    if (data.quantity_m2 === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["quantity_m2"],
        message: "Изменение должно быть больше 0",
      });
    }
    if (!data.password?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["password"],
        message: "Введите пароль для подтверждения корректировки",
      });
    }
    return;
  }

  if (data.quantity_m2 <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["quantity_m2"],
      message: "Количество должно быть больше 0",
    });
  }
});

export const stockHistoryQuerySchema = z.object({
  stock_item_id: z.string().uuid().optional(),
  movement_type: stockMovementTypeSchema.optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  search: z.string().trim().optional(),
  supplier_or_store: z.string().trim().optional(),
  created_by: z.string().trim().optional(),
  material: z.string().trim().optional(),
  collection: z.string().trim().optional(),
  model: z.string().trim().optional(),
  color: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(200).default(20),
});

export type StockListQuery = z.infer<typeof stockListQuerySchema>;
export type CreateStockMovementInput = z.infer<typeof createStockMovementSchema>;
export type StockHistoryQuery = z.infer<typeof stockHistoryQuerySchema>;
