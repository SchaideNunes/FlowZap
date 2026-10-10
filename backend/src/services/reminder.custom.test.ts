import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReminderService } from './reminder.service.js';
import { TemplateService } from './template.service.js';

describe('ReminderService: mensagens personalizadas', () => {
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

  let config: { get: ReturnType<typeof vi.fn> };
  let service: ReminderService;

  beforeEach(() => {
    const vendaRepo = { findActiveVendas: vi.fn().mockResolvedValue([venda]) };
    const historicoRepo = {
      hasMessageBeenSentForCycle: vi.fn().mockResolvedValue(false),
      findByVendaId: vi.fn().mockResolvedValue([]),
    };
    const billing = { evaluateReminderState: vi.fn().mockReturnValue({ tipo: 'lembrete_3d', novoStatus: 'avisado_3d' }) };
    config = { get: vi.fn().mockResolvedValue({ envio_automatico: true, mensagens: {} }) };

    service = new ReminderService(
      vendaRepo as any,
      historicoRepo as any,
      billing as any,
      new TemplateService(),
      { enqueue: vi.fn() } as any,
      config as any
    );
  });

  it('usa o texto personalizado do aviso do dia', async () => {
    config.get.mockResolvedValue({
      envio_automatico: true,
      mensagens: { lembrete_3d: '{nome}, faltam 3 dias para {vencimento}.' },
    });

    const [item] = await service.previewReminders('2026-09-15');

    expect(item.mensagem).toBe('Maria Silva, faltam 3 dias para 18/09/2026.');
  });

  it('sem personalização, usa a mensagem padrão', async () => {
    const [item] = await service.previewReminders('2026-09-15');

    expect(item.mensagem).toContain('vence em 3 dias');
  });

  it('usa o texto personalizado do aviso final na lista de atrasados', async () => {
    config.get.mockResolvedValue({
      envio_automatico: true,
      mensagens: { vencido: '{nome}, sua parcela de R$ {valor} está em aberto.' },
    });

    const [item] = await service.getOverdueReminders('2026-09-20');

    expect(item.mensagemCobranca).toBe('Maria Silva, sua parcela de R$ 100,00 está em aberto.');
  });
});
