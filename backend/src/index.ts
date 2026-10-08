import './config/env.js';
import path from 'path';
import { createApp } from './app.js';
import { BaileysService } from './services/baileys.service.js';
import { SedeHeartbeatService } from './services/sede-heartbeat.service.js';
import {
  createBaileysSocketFactory,
  hasRegisteredSession,
  clearAuthDir,
} from './services/baileys.socket-factory.js';

const port = Number(process.env.PORT) || 3001;
const host = process.env.HOST || '0.0.0.0';

// Na Vercel (serverless) não há processo contínuo: o WhatsApp só conecta na máquina-sede.
const isServerless = Boolean(process.env.VERCEL);

const authDir = path.resolve(process.env.WHATSAPP_AUTH_DIR || path.join(process.cwd(), '.whatsapp-auth'));

const whatsApp = isServerless
  ? undefined
  : new BaileysService({
      createSocket: createBaileysSocketFactory(authDir),
      clearAuth: () => clearAuthDir(authDir),
      hasSession: () => hasRegisteredSession(authDir),
    });

const { app, scheduler, sedeStatusRepo } = createApp({ whatsAppGateway: whatsApp });
const heartbeat = whatsApp ? new SedeHeartbeatService(sedeStatusRepo, whatsApp) : undefined;

let server: any;

// Inicia o listener HTTP em servidores tradicionais ou com porta configurada
if (!process.env.VERCEL || process.env.PORT) {
  server = app.listen(port, () => {
    console.log(`=======================================================`);
    console.log(`🚀 Flow-Zap Backend rodando com sucesso!`);
    console.log(`📡 Local:        http://localhost:${port}`);
    console.log(`🌐 Rede Local:   http://${host}:${port}`);
    console.log(`=======================================================`);
  });
}

if (!isServerless) {
  // Inicia o agendador automático diário de cobranças
  scheduler.start();

  // Avisa o painel online que a sede está ligada
  heartbeat?.start();

  // Se o computador estava desligado no horário agendado, recupera a rotina do dia
  scheduler
    .runCatchUpIfNeeded()
    .catch((error) => console.error('[Scheduler] Erro na rotina de recuperação:', error));

  // Reabre a sessão salva do WhatsApp. Sem sessão, a conexão só é aberta quando
  // alguém pede o QR Code no painel, evitando tentativas à toa.
  if (whatsApp && hasRegisteredSession(authDir)) {
    void whatsApp.start();
  } else {
    console.log('[WhatsApp] Nenhum número conectado. Abra o painel e leia o QR Code para conectar.');
  }
}

const shutdown = () => {
  console.log('\nEncerrando servidor Flow-Zap com segurança...');
  scheduler.stop();
  heartbeat?.stop();
  whatsApp?.stop();
  if (server) {
    server.close(() => {
      console.log('Servidor finalizado.');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
};

// Rede de segurança: uma falha inesperada em uma tarefa em segundo plano (ex.: banco fora do ar
// durante um envio) deve ser registrada, não derrubar o sistema que precisa ficar ligado.
process.on('unhandledRejection', (reason) => {
  console.error('[Erro não tratado]', reason instanceof Error ? reason.message : reason);
});

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export { app, scheduler };
export default app;
