import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TemplateService, TEMPLATE_VARIABLES, DEFAULT_TEMPLATES } from './template.service.js';
import { ConfiguracaoService } from './configuracao.service.js';
import { ReminderService } from './reminder.service.js';
import { UpdateConfiguracaoSchema } from '../schemas/configuracao.schema.js';

describe('Chave Pix nas mensagens', () => {
  describe('TemplateService', () => {
    const service = new TemplateService();
    const data = { nome: 'Ana', valor: 50, dataVencimento: '01/10/2026' };

    it('{pix} é uma variável disponível e não altera as mensagens padrão', () => {
      expect(TEMPLATE_VARIABLES.map((v) => v.chave)).toContain('{pix}');
      for (const template of Object.values(DEFAULT_TEMPLATES)) {
        expect(template).not.toContain('{pix}');
      }
    });

    it('troca {pix} pela chave configurada', () => {
      const message = service.generateMessage(
        'vencido',
        { ...data, chavePix: 'loja@exemplo.com' },
        '{nome}, pague pelo Pix: {pix}'
      );

      expect(message).toBe('Ana, pague pelo Pix: loja@exemplo.com');
    });

    it('sem chave configurada, {pix} fica vazio em vez de aparecer para o cliente', () => {
      expect(service.generateMessage('vencido', data, '{nome}, Pix: {pix}')).toBe('Ana, Pix: ');
    });
  });

  describe('ConfiguracaoService', () => {
    let repo: { get: ReturnType<typeof vi.fn>; save: ReturnType<typeof vi.fn> };
    let service: ConfiguracaoService;

    beforeEach(() => {
      repo = { get: vi.fn().mockResolvedValue(null), save: vi.fn().mockImplementation(async (c) => c) };
      service = new ConfiguracaoService(repo as any);
    });

    it('sem registro, não há chave Pix', async () => {
      expect((await service.get()).chave_pix).toBeNull();
    });

    it('grava a chave sem espaços nas pontas', async () => {
      await service.update({ chave_pix: '  loja@exemplo.com  ' });

      expect(repo.save).toHaveBeenCalledWith({
        envio_automatico: true,
        mensagens: {},
        chave_pix: 'loja@exemplo.com',
      });
    });

    it('chave vazia ou nula remove a chave', async () => {
      repo.get.mockResolvedValue({ envio_automatico: true, mensagens: {}, chave_pix: 'loja@exemplo.com' });

      await service.update({ chave_pix: '' });

      expect(repo.save).toHaveBeenCalledWith({ envio_automatico: true, mensagens: {}, chave_pix: null });
    });

    it('preserva a chave ao alterar outra configuração', async () => {
      repo.get.mockResolvedValue({ envio_automatico: true, mensagens: {}, chave_pix: 'loja@exemplo.com' });

      await service.update({ envio_automatico: false });

      expect(repo.save).toHaveBeenCalledWith({
        envio_automatico: false,
        mensagens: {},
        chave_pix: 'loja@exemplo.com',
      });
    });

    it('sem chave e sem mexer nela, não envia a coluna (banco ainda sem a migração continua salvando)', async () => {
      await service.update({ envio_automatico: false });

      expect(repo.save).toHaveBeenCalledWith({ envio_automatico: false, mensagens: {} });
    });
  });

  describe('validação', () => {
    it('aceita só a chave Pix', () => {
      expect(UpdateConfiguracaoSchema.safeParse({ chave_pix: 'loja@exemplo.com' }).success).toBe(true);
      expect(UpdateConfiguracaoSchema.safeParse({ chave_pix: null }).success).toBe(true);
    });

    it('recusa chave longa demais', () => {
      expect(UpdateConfiguracaoSchema.safeParse({ chave_pix: 'x'.repeat(141) }).success).toBe(false);
    });

    it('aceita mensagem personalizada com {pix}', () => {
      const result = UpdateConfiguracaoSchema.safeParse({
        mensagens: { vencido: '{saudacao} {nome}, pague pelo Pix: {pix}' },
      });
      expect(result.success).toBe(true);
    });
  });

  describe('ReminderService', () => {
    it('os avisos saem com a chave Pix configurada', async () => {
      const venda = {
        id: 101,
        cliente_id: 1,
        descricao: 'Plano 1',
        valor: 100,
        dia_vencimento: 18,
        status_mes_atual: 'pendente' as const,
        data_vencimento_atual: '2026-09-18',
        ativo: true,
        cliente: { id: 1, nome: 'Maria Silva', whatsapp: '5511999999999', ativo: true },
      };
      const config = {
        get: vi.fn().mockResolvedValue({
          envio_automatico: true,
          mensagens: { lembrete_3d: '{nome}, Pix: {pix}' },
          chave_pix: 'loja@exemplo.com',
        }),
      };
      const service = new ReminderService(
        { findActiveVendas: vi.fn().mockResolvedValue([venda]) } as any,
        { hasMessageBeenSentForCycle: vi.fn().mockResolvedValue(false) } as any,
        { evaluateReminderState: vi.fn().mockReturnValue({ tipo: 'lembrete_3d', novoStatus: 'avisado_3d' }) } as any,
        new TemplateService(),
        { enqueue: vi.fn() } as any,
        config as any
      );

      const [item] = await service.previewReminders('2026-09-15');

      expect(item.mensagem).toBe('Maria Silva, Pix: loja@exemplo.com');
    });
  });
});
