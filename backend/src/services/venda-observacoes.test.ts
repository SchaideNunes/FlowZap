import { describe, it, expect, vi } from 'vitest';
import { SupabaseClient } from '@supabase/supabase-js';
import { CreateVendaSchema, UpdateVendaSchema } from '../schemas/venda.schema.js';
import { SupabaseVendaRepository } from '../repositories/supabase-venda.repository.js';
import { TemplateService } from './template.service.js';

describe('Observações da venda (só para consulta, não vão na mensagem)', () => {
  const base = { cliente_id: 1, descricao: 'iPhone 13', valor: 300, dia_vencimento: 10 };

  it('aceita observação ao criar e ao editar, sem espaços nas pontas', () => {
    const criada = CreateVendaSchema.safeParse({ ...base, observacoes: '  Pagou a entrada em dinheiro  ' });
    expect(criada.success && criada.data.observacoes).toBe('Pagou a entrada em dinheiro');

    expect(UpdateVendaSchema.safeParse({ observacoes: 'Trocou o aparelho' }).success).toBe(true);
    expect(UpdateVendaSchema.safeParse({ observacoes: null }).success).toBe(true);
  });

  it('recusa observação longa demais', () => {
    expect(CreateVendaSchema.safeParse({ ...base, observacoes: 'x'.repeat(1001) }).success).toBe(false);
  });

  it('grava a observação só quando ela existe (banco sem a coluna continua cadastrando vendas)', async () => {
    const insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 1 }, error: null }) }),
    });
    const repo = new SupabaseVendaRepository({ from: vi.fn().mockReturnValue({ insert }) } as unknown as SupabaseClient);

    await repo.create({ ...base, observacoes: 'Cliente antigo', data_vencimento_atual: '2026-10-10', ativo: true });
    await repo.create({ ...base, data_vencimento_atual: '2026-10-10', ativo: true });

    expect(insert.mock.calls[0][0].observacoes).toBe('Cliente antigo');
    expect(insert.mock.calls[1][0]).not.toHaveProperty('observacoes');
  });

  it('a observação não entra no texto do aviso enviado ao cliente', () => {
    const template = new TemplateService();
    const data = { nome: 'Ana', descricao: 'iPhone 13', valor: 300, dataVencimento: '10/10/2026' };

    for (const tipo of ['lembrete_3d', 'lembrete_2d', 'lembrete_1d', 'vencido'] as const) {
      expect(template.generateMessage(tipo, { ...data, observacoes: 'NÃO ENVIAR' } as any)).not.toContain('NÃO ENVIAR');
    }
  });
});
