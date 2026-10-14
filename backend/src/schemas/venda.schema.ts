import { z } from 'zod';

export const VendaStatusEnum = z.enum([
  'pendente',
  'avisado_3d',
  'avisado_1d',
  'vencido',
  'pago',
]);

export type VendaStatus = z.infer<typeof VendaStatusEnum>;

// Nome de quem comprou sem ter cadastro (venda sem cliente_id; não recebe avisos no WhatsApp)
const ClienteAvulsoSchema = z
  .string()
  .trim()
  .min(2, { message: 'Informe o nome do cliente' })
  .max(120, { message: 'O nome do cliente pode ter no máximo 120 caracteres' });

// Anotação interna da venda: aparece só no painel, nunca na mensagem ao cliente
const ObservacoesSchema = z
  .string()
  .trim()
  .max(1000, { message: 'As observações podem ter no máximo 1000 caracteres' });

export const VendaSchema = z.object({
  id: z.number().int().positive().optional(),
  cliente_id: z.number().int().positive({ message: 'cliente_id inválido' }).nullable().optional(),
  cliente_avulso: ClienteAvulsoSchema.nullable().optional(),
  descricao: z.string().trim().min(1, { message: 'Descrição é obrigatória' }),
  valor: z.number().positive({ message: 'O valor deve ser maior que zero' }),
  dia_vencimento: z
    .number()
    .int()
    .min(1, { message: 'Dia do vencimento deve ser entre 1 e 31' })
    .max(31, { message: 'Dia do vencimento deve ser entre 1 e 31' }),
  valor_total: z.number().positive().nullable().optional(),
  taxa_juros: z.number().min(0).nullable().optional(),
  total_parcelas: z.number().int().min(1).nullable().optional(),
  parcela_atual: z.number().int().min(1).default(1).optional(),
  status_mes_atual: VendaStatusEnum.default('pendente'),
  data_vencimento_atual: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  ativo: z.boolean().default(true),
  observacoes: ObservacoesSchema.nullable().optional(),
});

export const CreateVendaSchema = z
  .object({
  cliente_id: z.number().int().positive({ message: 'cliente_id inválido' }).optional(),
  cliente_avulso: ClienteAvulsoSchema.optional(),
  descricao: z.string().trim().min(1, { message: 'Descrição é obrigatória' }),
  valor: z.number().positive({ message: 'O valor deve ser maior que zero' }),
  dia_vencimento: z
    .number()
    .int()
    .min(1, { message: 'Dia do vencimento deve ser entre 1 e 31' })
    .max(31, { message: 'Dia do vencimento deve ser entre 1 e 31' }),
  valor_total: z.number().positive().nullable().optional(),
  taxa_juros: z.number().min(0).nullable().optional(),
  total_parcelas: z.number().int().min(1).nullable().optional(),
  parcela_atual: z.number().int().min(1).default(1).optional(),
  data_vencimento_atual: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  ativo: z.boolean().default(true),
  observacoes: ObservacoesSchema.optional(),
  })
  .refine((data) => (data.cliente_id === undefined) !== (data.cliente_avulso === undefined), {
    message: 'Informe um cliente cadastrado ou o nome de um cliente sem cadastro',
    path: ['cliente_id'],
  });

export const UpdateVendaSchema = z.object({
  // Vincular a um cliente cadastrado uma venda feita sem cadastro
  cliente_id: z.number().int().positive().optional(),
  cliente_avulso: ClienteAvulsoSchema.nullable().optional(),
  descricao: z.string().trim().min(1).optional(),
  valor: z.number().positive().optional(),
  dia_vencimento: z.number().int().min(1).max(31).optional(),
  valor_total: z.number().positive().nullable().optional(),
  taxa_juros: z.number().min(0).nullable().optional(),
  total_parcelas: z.number().int().min(1).nullable().optional(),
  parcela_atual: z.number().int().min(1).optional(),
  status_mes_atual: VendaStatusEnum.optional(),
  data_vencimento_atual: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  ativo: z.boolean().optional(),
  // Vazio ou nulo apaga a observação
  observacoes: ObservacoesSchema.nullable().optional(),
});

export type VendaDTO = z.infer<typeof VendaSchema>;
export type CreateVendaDTO = z.infer<typeof CreateVendaSchema>;
export type UpdateVendaDTO = z.infer<typeof UpdateVendaSchema>;
