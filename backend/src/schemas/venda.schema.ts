import { z } from 'zod';

export const VendaStatusEnum = z.enum([
  'pendente',
  'avisado_3d',
  'avisado_1d',
  'vencido',
  'pago',
]);

export type VendaStatus = z.infer<typeof VendaStatusEnum>;

export const VendaSchema = z.object({
  id: z.number().int().positive().optional(),
  cliente_id: z.number().int().positive({ message: 'cliente_id inválido' }),
  descricao: z.string().trim().min(1, { message: 'Descrição é obrigatória' }),
  valor: z.number().positive({ message: 'O valor deve ser maior que zero' }),
  dia_vencimento: z
    .number()
    .int()
    .min(1, { message: 'Dia do vencimento deve ser entre 1 e 31' })
    .max(31, { message: 'Dia do vencimento deve ser entre 1 e 31' }),
  status_mes_atual: VendaStatusEnum.default('pendente'),
  data_vencimento_atual: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  ativo: z.boolean().default(true),
});

export const CreateVendaSchema = z.object({
  cliente_id: z.number().int().positive({ message: 'cliente_id inválido' }),
  descricao: z.string().trim().min(1, { message: 'Descrição é obrigatória' }),
  valor: z.number().positive({ message: 'O valor deve ser maior que zero' }),
  dia_vencimento: z
    .number()
    .int()
    .min(1, { message: 'Dia do vencimento deve ser entre 1 e 31' })
    .max(31, { message: 'Dia do vencimento deve ser entre 1 e 31' }),
  data_vencimento_atual: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  ativo: z.boolean().default(true),
});

export const UpdateVendaSchema = z.object({
  descricao: z.string().trim().min(1).optional(),
  valor: z.number().positive().optional(),
  dia_vencimento: z.number().int().min(1).max(31).optional(),
  status_mes_atual: VendaStatusEnum.optional(),
  data_vencimento_atual: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  ativo: z.boolean().optional(),
});

export type VendaDTO = z.infer<typeof VendaSchema>;
export type CreateVendaDTO = z.infer<typeof CreateVendaSchema>;
export type UpdateVendaDTO = z.infer<typeof UpdateVendaSchema>;
