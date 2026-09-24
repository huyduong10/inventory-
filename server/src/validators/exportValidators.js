import { z } from 'zod';

export const exportItemSchema = z.object({
  product: z.string().min(1, 'Product is required.'),
  quantity: z.number().min(1, 'Quantity must be at least 1.'),
  unit: z.string().trim().default(''),
  note: z.string().trim().default(''),
});

export const createExportOrderSchema = z.object({
  department: z.string().trim().min(1, 'Department is required.'),
  recipientName: z.string().trim().min(1, 'Recipient name is required.'),
  createdByUser: z.string().trim().optional(),
  exportDate: z.coerce.date().optional(),
  status: z.enum(['Draft', 'Completed', 'Cancelled']).default('Completed'),
  note: z.string().trim().optional(),
  items: z.array(exportItemSchema).min(1, 'At least one item is required.'),
});

export const updateExportStatusSchema = z.object({
  status: z.enum(['Draft', 'Completed', 'Cancelled']),
  note: z.string().trim().optional(),
});
