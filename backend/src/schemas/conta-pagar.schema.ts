import { z } from 'zod';

export const ContaPagarSchema = z.object({
  id: z.number().int().positive().optional(),
  nome_credor: z.string().trim().min(2, { message: 'Nome do credor deve ter no mínimo 2 caracteres' }),
  descricao: z.string().trim().nullable().optional(),
  valor: z.number().positive({ message: 'Valor deve ser positivo' }),
  data_vencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Data de vencimento deve estar no formato AAAA-MM-DD' }).nullable().optional(),
  pago: z.boolean().default(false),
  data_pagamento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Data de pagamento deve estar no formato AAAA-MM-DD' }).nullable().optional(),
  observacoes: z.string().trim().nullable().optional(),
  criado_em: z.string().optional(),
  atualizado_em: z.string().optional(),
});

export const CreateContaPagarSchema = ContaPagarSchema.omit({ id: true, criado_em: true, atualizado_em: true });
export const UpdateContaPagarSchema = CreateContaPagarSchema.partial();

export type ContaPagarDTO = z.infer<typeof ContaPagarSchema>;
export type CreateContaPagarDTO = z.infer<typeof CreateContaPagarSchema>;
export type UpdateContaPagarDTO = z.infer<typeof UpdateContaPagarSchema>;
