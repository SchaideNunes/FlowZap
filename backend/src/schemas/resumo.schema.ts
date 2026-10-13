import { z } from 'zod';

export const ResumoMensalQuerySchema = z.object({
  mes: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'O mês deve estar no formato AAAA-MM' })
    .optional(),
});

export type ResumoMensalQuery = z.infer<typeof ResumoMensalQuerySchema>;
