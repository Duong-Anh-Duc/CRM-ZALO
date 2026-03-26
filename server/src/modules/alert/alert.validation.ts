import { z } from 'zod';

export const takeActionSchema = z.object({
  action: z.string().min(1),
  new_expected_date: z.string().optional(),
});
