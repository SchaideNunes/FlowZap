import { describe, it, expect, vi } from 'vitest';
import { TemplateService, DEFAULT_TEMPLATES, TEMPLATE_VARIABLES, findUnknownVariables } from './template.service.js';

describe('TemplateService: mensagens personalizadas', () => {
  const service = new TemplateService();
  vi.spyOn(service, 'getDynamicGreeting').mockReturnValue('Olá');

  const data = {
    nome: 'Carlos Santos',
    descricao: 'iPhone 13',
    valor: 149.9,
    dataVencimento: '15/09/2026',
    parcelaAtual: 2,
    totalParcelas: 10,
  };

  it('as mensagens padrão continuam com o mesmo texto de antes', () => {
    expect(service.generateMessage('lembrete_3d', data)).toBe(
      'Olá Carlos Santos, passando para lembrar que sua cobrança referente a *iPhone 13 (Parcela 2 de 10)*, no valor de *R$ 149,90*, vence em 3 dias, no dia *15/09/2026*.'
    );
    expect(service.generateMessage('vencido', { ...data, descricao: null, parcelaAtual: null, totalParcelas: null })).toBe(
      'Olá Carlos Santos, identificamos que sua cobrança, no valor de *R$ 149,90*, com vencimento em *15/09/2026*, ainda está em aberto. Qualquer dúvida ou se já efetuou o pagamento, nos avise por favor!'
    );
  });

  it('usa o texto personalizado, trocando as variáveis', () => {
    const message = service.generateMessage(
      'vencido',
      data,
      '{saudacao} {nome}! Sua parcela de {produto} (R$ {valor}) venceu em {vencimento}.'
    );

    expect(message).toBe('Olá Carlos Santos! Sua parcela de iPhone 13 (Parcela 2 de 10) (R$ 149,90) venceu em 15/09/2026.');
  });

  it('{referencia} some quando a venda não tem descrição nem parcelas', () => {
    const message = service.generateMessage(
      'lembrete_1d',
      { nome: 'Ana', valor: 50, dataVencimento: '01/10/2026' },
      '{nome}, sua cobrança{referencia} vence amanhã.'
    );

    expect(message).toBe('Ana, sua cobrança vence amanhã.');
  });

  it('texto personalizado vazio cai na mensagem padrão', () => {
    expect(service.generateMessage('lembrete_2d', data, '   ')).toBe(service.generateMessage('lembrete_2d', data));
  });

  it('há uma mensagem padrão para cada aviso e todas usam só variáveis conhecidas', () => {
    expect(Object.keys(DEFAULT_TEMPLATES).sort()).toEqual(['lembrete_1d', 'lembrete_2d', 'lembrete_3d', 'vencido']);
    for (const template of Object.values(DEFAULT_TEMPLATES)) {
      expect(findUnknownVariables(template)).toEqual([]);
    }
    expect(TEMPLATE_VARIABLES.map((v) => v.chave)).toContain('{saudacao}');
  });

  it('aponta variáveis que não existem', () => {
    expect(findUnknownVariables('Olá {cliente}, vence em {vencimento} e {dia}')).toEqual(['{cliente}', '{dia}']);
  });
});
