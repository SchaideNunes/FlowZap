import { z } from 'zod';

export const ClienteSchema = z.object({
  id: z.number().int().positive().optional(),
  nome: z.string().trim().min(2, { message: 'Nome deve ter no mínimo 2 caracteres' }),
  whatsapp: z
    .string()
    .trim()
    .regex(/^\d{10,15}$/, {
      message: 'WhatsApp deve conter apenas números no formato com DDD (ex: 5511999999999)',
    }),
  ativo: z.boolean().default(true),
  observacoes: z.string().trim().nullable().optional(),
});

export const CreateClienteSchema = ClienteSchema.omit({ id: true });
export const UpdateClienteSchema = CreateClienteSchema.partial();

export type ClienteDTO = z.infer<typeof ClienteSchema>;
export type CreateClienteDTO = z.infer<typeof CreateClienteSchema>;
export type UpdateClienteDTO = z.infer<typeof UpdateClienteSchema>;
