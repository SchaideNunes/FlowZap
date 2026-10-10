import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfiguracaoService } from './configuracao.service.js';
import { IConfiguracaoRepository } from '../repositories/configuracao.repository.interface.js';

describe('ConfiguracaoService', () => {
  let repo: { get: ReturnType<typeof vi.fn>; save: ReturnType<typeof vi.fn> };
  let service: ConfiguracaoService;

  beforeEach(() => {
    repo = {
      get: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockImplementation(async (config) => config),
    };
    service = new ConfiguracaoService(repo as unknown as IConfiguracaoRepository);
  });

  describe('get', () => {
    it('sem registro, o envio automático fica ligado e as mensagens são as padrão', async () => {
      expect(await service.get()).toEqual({ envio_automatico: true, mensagens: {} });
    });

    it('devolve o que está gravado', async () => {
      repo.get.mockResolvedValue({ envio_automatico: false, mensagens: { vencido: 'Oi {nome}, sua conta venceu.' } });

      expect(await service.get()).toEqual({
        envio_automatico: false,
        mensagens: { vencido: 'Oi {nome}, sua conta venceu.' },
      });
    });

    it('se a leitura falhar (ex.: tabela ainda não criada), mantém o comportamento padrão', async () => {
      repo.get.mockRejectedValue(new Error('relation does not exist'));

      expect(await service.get()).toEqual({ envio_automatico: true, mensagens: {} });
    });

    it('ignora valores inválidos gravados no banco', async () => {
      repo.get.mockResolvedValue({ envio_automatico: null, mensagens: { vencido: '   ', lembrete_1d: 42, outro: 'x' } });

      expect(await service.get()).toEqual({ envio_automatico: true, mensagens: {} });
    });
  });

  describe('update', () => {
    it('desliga o envio automático sem mexer nas mensagens', async () => {
      repo.get.mockResolvedValue({ envio_automatico: true, mensagens: { vencido: 'Texto próprio do vencido' } });

      const result = await service.update({ envio_automatico: false });

      expect(repo.save).toHaveBeenCalledWith({
        envio_automatico: false,
        mensagens: { vencido: 'Texto próprio do vencido' },
      });
      expect(result.envio_automatico).toBe(false);
    });

    it('grava só a mensagem alterada e preserva as demais', async () => {
      repo.get.mockResolvedValue({ envio_automatico: true, mensagens: { vencido: 'Texto próprio do vencido' } });

      await service.update({ mensagens: { lembrete_1d: '  {saudacao} {nome}, vence amanhã.  ' } });

      expect(repo.save).toHaveBeenCalledWith({
        envio_automatico: true,
        mensagens: {
          vencido: 'Texto próprio do vencido',
          lembrete_1d: '{saudacao} {nome}, vence amanhã.',
        },
      });
    });

    it('mensagem vazia ou nula volta para a padrão', async () => {
      repo.get.mockResolvedValue({
        envio_automatico: true,
        mensagens: { vencido: 'Texto próprio do vencido', lembrete_3d: 'Texto próprio dos 3 dias' },
      });

      await service.update({ mensagens: { vencido: null, lembrete_3d: '' } });

      expect(repo.save).toHaveBeenCalledWith({ envio_automatico: true, mensagens: {} });
    });

    it('explica a migração quando não consegue gravar', async () => {
      repo.save.mockRejectedValue(new Error('relation "configuracoes" does not exist'));

      await expect(service.update({ envio_automatico: false })).rejects.toThrow(/migration_configuracoes\.sql/);
    });
  });
});
