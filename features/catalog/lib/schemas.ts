import { z } from "zod";

export const catalogTypeSchema = z.enum(["material", "profile", "cap", "fixator"]);

export const createCollectionSchema = z.object({
  name: z.string().trim().min(2, "Название должно быть минимум 2 символа"),
  type: catalogTypeSchema,
  price_per_m2: z.coerce.number().min(0, "Цена не может быть отрицательной"),
});

export const updateCollectionSchema = z.object({
  name: z.string().trim().min(2).optional(),
  price_per_m2: z.coerce.number().min(0).optional(),
});

export const createModelSchema = z.object({
  model_code: z.string().trim().min(1, "Код модели обязателен").max(20),
  color_name: z.string().trim().min(2, "Название цвета обязательно"),
  color_hex: z
    .string()
    .trim()
    .regex(/^#([0-9a-fA-F]{6})$/, "HEX цвет должен быть в формате #RRGGBB"),
  price_per_m2: z.coerce.number().min(0, "Цена не может быть отрицательной"),
  sku: z.string().trim().optional().nullable(),
  sort_order: z.coerce.number().int().min(0).optional(),
});

export const updateModelSchema = z.object({
  model_code: z.string().trim().min(1).max(20).optional(),
  color_name: z.string().trim().min(2).optional(),
  color_hex: z
    .string()
    .trim()
    .regex(/^#([0-9a-fA-F]{6})$/, "HEX цвет должен быть в формате #RRGGBB")
    .optional(),
  price_per_m2: z.coerce.number().min(0).optional(),
  sku: z.string().trim().optional().nullable(),
  sort_order: z.coerce.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
});

export type CreateCollectionInput = z.infer<typeof createCollectionSchema>;
export type UpdateCollectionInput = z.infer<typeof updateCollectionSchema>;
export type CreateModelInput = z.infer<typeof createModelSchema>;
export type UpdateModelInput = z.infer<typeof updateModelSchema>;
