import { z } from 'zod';

export const upsertCustomerProductPriceSchema = z.object({
  customer_id: z.string().min(1),
  product_id: z.string().min(1),
  price: z.number().nonnegative(),
});
