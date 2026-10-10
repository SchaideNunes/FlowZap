import { z } from 'zod';
import { findUnknownVariables } from '../services/template.service.js';

// Vazio ou nulo significa "voltar para a mensagem padrão"
const MensagemSchema = z
  .string()
  .trim()
  .max(1000, { message: 'A mensagem pode ter no máximo 1000 caracteres' })
  .refine((texto) => texto.length === 0 || texto.length >= 10, {
    message: 'A mensagem deve ter no mínimo 10 caracteres',
  })
  .refine((texto) => texto.length === 0 || texto.includes('{saudacao}'), {
    message: 'A mensagem precisa ter {saudacao}: a saudação variada protege o número contra bloqueio',
  })
  .superRefine((texto, ctx) => {
    const unknown = findUnknownVariables(texto);
    if (unknown.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Variável desconhecida: ${unknown.join(', ')}`,
      });
    }
  })
  .nullable()
  .optional();

export const UpdateConfiguracaoSchema = z
  .object({
    envio_automatico: z.boolean().optional(),
    mensagens: z
      .object({
        lembrete_3d: MensagemSchema,
        lembrete_2d: MensagemSchema,
        lembrete_1d: MensagemSchema,
        vencido: MensagemSchema,
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine((data) => data.envio_automatico !== undefined || data.mensagens !== undefined, {
    message: 'Nada para alterar',
  });

export type UpdateConfiguracaoDTO = z.infer<typeof UpdateConfiguracaoSchema>;
