import { z } from 'zod';

export const EmailSchema = z.object({
  email: z
    .string()
    .min(5, 'Email must be at least 5 characters long')
    .max(255, 'Email must be at most 255 characters long')
    .email('Invalid email format'),
});
