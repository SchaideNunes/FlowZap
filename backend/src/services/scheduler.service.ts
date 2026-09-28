import cron from 'node-cron';
import { ReminderService } from './reminder.service.js';

export class SchedulerService {
  private reminderService: ReminderService;
  private cronExpression: string;
  private task: cron.ScheduledTask | null = null;

  constructor(reminderService: ReminderService, cronExpression: string = '0 9 * * *') {
    this.reminderService = reminderService;
    this.cronExpression = cronExpression;
  }

  start(): void {
    if (this.task) {
      this.task.stop();
    }

    console.log(`[Scheduler] Iniciando agendador diário com expressão: "${this.cronExpression}"`);

    this.task = cron.schedule(this.cronExpression, async () => {
      console.log(`[Scheduler] Executando rotina diária de cobrança automática: ${new Date().toISOString()}`);
      try {
        const result = await this.reminderService.dispatchReminders();
        console.log(`[Scheduler] Rotina finalizada com sucesso. ${result.dispatchedCount} lembrete(s) enfileirados.`);
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
}
