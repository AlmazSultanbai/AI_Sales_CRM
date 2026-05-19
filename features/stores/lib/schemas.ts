import { z } from "zod";

export const storeFilterSchema = z.enum(["all", "with_debt", "without_debt", "inactive"]).default("all");
export const storeSortSchema = z.enum(["name", "debt", "activity"]).default("name");

export const createStoreSchema = z.object({
  name: z.string().trim().min(2, "Название магазина обязательно"),
  contact_person: z.string().trim().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  address: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

export const updateStoreSchema = createStoreSchema.partial().extend({
  is_active: z.boolean().optional(),
});

export const purchaseItemSchema = z.object({
  collection_id: z.string().uuid().nullable().optional(),
  collection_model_id: z.string().uuid().nullable().optional(),
  item_name_snapshot: z.string().trim().min(1, "Укажите товар"),
  item_image_url_snapshot: z.string().url().nullable().optional(),
  quantity: z.coerce.number().positive("Количество должно быть больше 0"),
  unit: z.enum(["m2", "meter", "piece", "pack"]),
  unit_price: z.coerce.number().nonnegative("Цена должна быть 0 или больше"),
});

export const createPurchaseSchema = z.object({
  purchase_date: z.string().min(1),
  comment: z.string().trim().optional().nullable(),
  items: z.array(purchaseItemSchema).min(1, "Добавьте хотя бы одну позицию"),
});

export const updatePurchaseSchema = createPurchaseSchema.extend({
  purchase_number: z.string().trim().optional(),
});

export const purchaseStatusSchema = z.enum(["all", "paid", "partial", "unpaid"]).default("all");

export const createPaymentSchema = z.object({
  purchase_id: z.string().uuid().nullable().optional(),
  amount: z.coerce.number().positive("Сумма оплаты должна быть больше 0"),
  payment_date: z.string().min(1),
  payment_method: z.enum(["cash", "bank", "card", "transfer"]),
  comment: z.string().trim().optional().nullable(),
});

export type CreateStoreInput = z.infer<typeof createStoreSchema>;
export type UpdateStoreInput = z.infer<typeof updateStoreSchema>;
export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;
export type UpdatePurchaseInput = z.infer<typeof updatePurchaseSchema>;
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
