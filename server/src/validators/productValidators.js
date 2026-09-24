import { z } from 'zod';

export const createProductSchema = z.object({
  name: z.string().trim().min(1, 'Product name is required.'),
  sku: z.string().trim().min(1, 'SKU is required.'),
  category: z.string().trim().default('General'),
  unit: z.string().trim().min(1, 'Unit is required.'),
  quantity: z.number().min(0).default(0),
  minThreshold: z.number().min(0).default(5),
  description: z.string().trim().default(''),
  location: z.string().trim().default(''),
  reason: z.string().trim().optional(),
  adjustmentReason: z.string().trim().optional(),
}).passthrough();

export const updateProductSchema = createProductSchema.partial().passthrough();
