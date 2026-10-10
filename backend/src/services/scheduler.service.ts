import cron from 'node-cron';
import { ReminderService } from './reminder.service.js';
import { ISedeStatusRepository } from '../repositories/sede-status.repository.interface.js';
import { ConfiguracaoService } from './configuracao.service.js';
import { parseDailyTime } from '../utils/cron-time.js';
import { formatDateToISO } from '../utils/date-calculator.js';

export class SchedulerService {
  private reminderService: ReminderService;
  private cronExpression: string;
  private sedeStatusRepo?: ISedeStatusRepository;
  private configService?: ConfiguracaoService;
  private task: cron.ScheduledTask | null = null;

  constructor(
    reminderService: ReminderService,
    cronExpression: string = '0 9 * * *',
    sedeStatusRepo?: ISedeStatusRepository,
    configService?: ConfiguracaoService
  ) {
    this.reminderService = reminderService;
    this.cronExpression = cronExpression;
    this.sedeStatusRepo = sedeStatusRepo;
    this.configService = configService;
  }

  start(): void {
    if (this.task) {
      this.task.stop();
    }

    console.log(`[Scheduler] Iniciando agendador diário com expressão: "${this.cronExpression}"`);

    this.task = cron.schedule(this.cronExpression, async () => {
      console.log(`[Scheduler] Executando rotina diária de cobrança automática: ${new Date().toISOString()}`);
      try {
        await this.runScheduledRoutine();
      } catch (error) {
        console.error('[Scheduler] Erro ao executar rotina diária:', error);
      }
    });
  }

  stop(): void {
    if (this.task) {
      this.task.stop();
      this.task = null;
      console.log('[Scheduler] Agendador parado.');
    }
  }

  /**
   * Se o computador estava desligado no horário agendado, executa a rotina do dia assim que
   * o sistema inicia. Devolve true quando a rotina foi executada agora.
   * Reenvios são evitados pela verificação de duplicidade do histórico de mensagens.
   */
  async runCatchUpIfNeeded(now: Date = new Date()): Promise<boolean> {
    const scheduled = parseDailyTime(this.cronExpression);
    if (!scheduled) return false;

    const minutesNow = now.getHours() * 60 + now.getMinutes();
    if (minutesNow < scheduled.hour * 60 + scheduled.minute) return false;

    const today = formatDateToISO(now);
    const lastRun = await this.readLastRoutineDate();
    if (lastRun === today) return false;

    if (!(await this.isAutomaticSendingEnabled())) {
      console.log('[Scheduler] Envio automático desligado no painel: a rotina de hoje não será recuperada.');
      return false;
    }

    console.log('[Scheduler] A rotina de hoje ainda não rodou (sistema iniciado após o horário). Executando agora.');
    await this.runRoutine(today);
    return true;
  }

  /**
   * Rotina do horário agendado. Devolve false (sem enviar nada) quando o envio automático
   * está desligado no painel; o disparo manual não passa por aqui.
   */
  async runScheduledRoutine(): Promise<boolean> {
    if (!(await this.isAutomaticSendingEnabled())) {
      console.log('[Scheduler] Envio automático desligado no painel: nenhum aviso enviado.');
      return false;
    }

    await this.runRoutine();
    return true;
  }

  private async isAutomaticSendingEnabled(): Promise<boolean> {
    if (!this.configService) return true;
    return (await this.configService.get()).envio_automatico;
  }

  private async runRoutine(today: string = formatDateToISO(new Date())): Promise<void> {
    const result = await this.reminderService.dispatchReminders();
    console.log(`[Scheduler] Rotina finalizada com sucesso. ${result.dispatchedCount} lembrete(s) enfileirados.`);

    try {
      await this.sedeStatusRepo?.markRoutineRun(today);
    } catch (error) {
      console.warn(
        `[Scheduler] Não foi possível registrar a execução da rotina: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  private async readLastRoutineDate(): Promise<string | null> {
    try {
      return (await this.sedeStatusRepo?.getStatus())?.ultima_rotina_data ?? null;
    } catch {
      // Sem o registro (tabela ainda não criada), roda e deixa o anti-duplicidade proteger
      return null;
    }
  }
}
