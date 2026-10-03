import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { getSupabaseClient } from './config/supabase.js';
import { SupabaseUserRepository } from './repositories/supabase-user.repository.js';
import { SupabaseClienteRepository } from './repositories/supabase-cliente.repository.js';
import { SupabaseVendaRepository } from './repositories/supabase-venda.repository.js';
import { SupabaseHistoricoRepository } from './repositories/supabase-historico.repository.js';
import { AuthService } from './services/auth.service.js';
import { BillingService } from './services/billing.service.js';
import { TemplateService } from './services/template.service.js';
import { EvolutionService } from './services/evolution.service.js';
import { MessageQueueService } from './services/message-queue.service.js';
import { ReminderService } from './services/reminder.service.js';
import { SchedulerService } from './services/scheduler.service.js';
import { AuthController } from './controllers/auth.controller.js';
import { ClienteController } from './controllers/cliente.controller.js';
import { VendaController } from './controllers/venda.controller.js';
import { CobrancaController } from './controllers/cobranca.controller.js';
import { SupabaseContaPagarRepository } from './repositories/supabase-conta-pagar.repository.js';
import { ContaPagarController } from './controllers/conta-pagar.controller.js';
import { createContaPagarRouter } from './routes/conta-pagar.routes.js';
import { createAuthRouter } from './routes/auth.routes.js';
import { createClienteRouter } from './routes/cliente.routes.js';
import { createVendaRouter } from './routes/venda.routes.js';
import { createCobrancaRouter } from './routes/cobranca.routes.js';

export function createApp(): { app: Express; scheduler: SchedulerService } {
  const app = express();

  // CORS configurado para permitir localhost e IP local da máquina-sede na rede interna
  app.use(
    cors({
      origin: true,
      credentials: true,
    })
  );
  app.use(express.json());

  // Rota de saúde pública (suporta acesso direto e via proxy /api)
  const healthHandler = (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  };
  app.get('/health', healthHandler);
  app.get('/api/health', healthHandler);

  // Inicialização de dependências
  const supabase = getSupabaseClient();
  const userRepo = new SupabaseUserRepository(supabase);
  const clienteRepo = new SupabaseClienteRepository(supabase);
  const vendaRepo = new SupabaseVendaRepository(supabase);
  const historicoRepo = new SupabaseHistoricoRepository(supabase);
  const contaPagarRepo = new SupabaseContaPagarRepository(supabase);

  const jwtSecret = process.env.JWT_SECRET || 'flowzap_jwt_secret_change_me_in_env_file';
  const authService = new AuthService(userRepo, jwtSecret);
  const billingService = new BillingService(vendaRepo, clienteRepo, historicoRepo);
  const templateService = new TemplateService();

  const evolutionBaseUrl = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
  const evolutionApiKey = process.env.EVOLUTION_API_KEY || 'flowzap_super_secret_evolution_key_2026';
  const evolutionInstanceName = process.env.EVOLUTION_INSTANCE_NAME || 'flowzap_cobranca';

  const evolutionService = new EvolutionService({
    baseUrl: evolutionBaseUrl,
    apiKey: evolutionApiKey,
    instanceName: evolutionInstanceName,
  });

  const minDelayMs = (Number(process.env.MIN_DELAY_SECONDS) || 8) * 1000;
  const maxDelayMs = (Number(process.env.MAX_DELAY_SECONDS) || 20) * 1000;
  const simulateTyping = process.env.SIMULATE_TYPING !== 'false';

  const queueService = new MessageQueueService(evolutionService, {
    minDelayMs,
    maxDelayMs,
    simulateTyping,
    typingDurationMs: 3000,
  });

  const reminderService = new ReminderService(
    vendaRepo,
    historicoRepo,
    billingService,
    templateService,
    queueService
  );

  const cronExpression = process.env.CRON_SCHEDULE || '0 9 * * *';
  const scheduler = new SchedulerService(reminderService, cronExpression);

  // Controladores
  const authController = new AuthController(authService);
  const clienteController = new ClienteController(clienteRepo);
  const vendaController = new VendaController(vendaRepo, historicoRepo, billingService);
  const cobrancaController = new CobrancaController(
    reminderService,
    evolutionService,
    queueService
  );
  const contaPagarController = new ContaPagarController(contaPagarRepo);

  // Registro das Rotas
  app.use('/api/auth', createAuthRouter(authService, authController));
  app.use('/api/clientes', createClienteRouter(clienteController, authService));
  app.use('/api/vendas', createVendaRouter(vendaController, authService));
  app.use('/api/cobrancas', createCobrancaRouter(cobrancaController, authService));
  app.use('/api/contas-pagar', createContaPagarRouter(contaPagarController, authService));

  // Middleware de erro global
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[Global Error]', err);
    res.status(500).json({ error: 'Erro interno no servidor' });
  });

  return { app, scheduler };
}

export default createApp;
