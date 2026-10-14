import './config/env.js';
import path from 'path';
import { createApp } from './create-app.js';
import { BaileysService } from './services/baileys.service.js';
import { SedeHeartbeatService } from './services/sede-heartbeat.service.js';
import { resolveBackupDir } from './config/backup-dir.js';
import { loadSedeIdentity } from './config/sede-id.js';
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

const { app, scheduler, sedeStatusRepo, backupService, sedeLock } = createApp({
  whatsAppGateway: whatsApp,
  backupDir: isServerless ? undefined : resolveBackupDir(),
  sedeIdentity: isServerless ? undefined : loadSedeIdentity(),
});
const heartbeat = whatsApp ? new SedeHeartbeatService(sedeStatusRepo, whatsApp, { lock: sedeLock }) : undefined;

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

  // Cópia diária dos dados em disco (proteção contra perda no banco em nuvem)
  backupService.startAutomatic();

  // O que só a sede faz: recuperar a rotina do dia e manter o WhatsApp conectado
  const startAsSede = () => {
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
  };

  if (sedeLock) {
    sedeLock.setOnChange((holder) => {
      if (holder) {
        console.log('[Sede] Este computador é a sede: as cobranças saem por aqui.');
        startAsSede();
      } else {
        console.log('[Sede] Outra máquina passou a ser a sede: este computador parou de enviar cobranças.');
        whatsApp?.stop();
      }
    });

    void sedeLock.acquire().then((holder) => {
      if (!holder) {
        const { sedeNome } = sedeLock.getInfo();
        console.log(
          `[Sede] Outra máquina já é a sede${sedeNome ? ` (${sedeNome})` : ''}. Este computador funciona só como painel.`
        );
      }
      // Renova a trava a cada minuto e, sendo a sede, avisa o painel online que está ligada
      heartbeat?.start();
    });
  } else {
    heartbeat?.start();
    startAsSede();
  }
}

const shutdown = () => {
  console.log('\nEncerrando servidor Flow-Zap com segurança...');
  scheduler.stop();
  heartbeat?.stop();
  backupService.stop();
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
