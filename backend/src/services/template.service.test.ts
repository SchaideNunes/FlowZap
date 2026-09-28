import { describe, it, expect } from 'vitest';
import { TemplateService } from './template.service.js';

describe('TemplateService (TDD)', () => {
  const templateService = new TemplateService();

  const mockData = {
    nome: 'Carlos Santos',
    descricao: 'Plano Pro 500MB',
    valor: 149.9,
    dataVencimento: '15/09/2026',
  };

  it('should format lembrete_3d message with all variables and valid greeting', () => {
    const message = templateService.generateMessage('lembrete_3d', mockData);

    expect(message).toContain('Carlos Santos');
    expect(message).toContain('Plano Pro 500MB');
    expect(message).toContain('149,90');
    expect(message).toContain('15/09/2026');
    expect(message).toContain('3 dias');
  });

  it('should format lembrete_1d message with all variables', () => {
    const message = templateService.generateMessage('lembrete_1d', mockData);

    expect(message).toContain('Carlos Santos');
    expect(message).toContain('amanhã');
    expect(message).toContain('15/09/2026');
    expect(message).toContain('149,90');
  });

  it('should format vencido message with overdue notice', () => {
    const message = templateService.generateMessage('vencido', mockData);

    expect(message).toContain('Carlos Santos');
    expect(message).toContain('em aberto');
    expect(message).toContain('15/09/2026');
    expect(message).toContain('149,90');
  });

  it('should humanize greetings dynamically (e.g. Olá, Oi, Bom dia/Boa tarde/Boa noite)', () => {
    const greeting = templateService.getDynamicGreeting();
    expect(['Olá', 'Oi', 'Tudo bem?', 'Como vai?']).toContain(greeting);
  });
});
