// Demonstração do Flow-Zap: a mesma API, com uma loja fictícia em memória.
// Não lê o .env, não acessa o Supabase e não envia mensagens: o WhatsApp é de mentira.
// Uso: npm run demo (e, em outro terminal, npm run demo dentro de frontend).
import crypto from 'node:crypto';
import { createApp } from '../create-app.js';
import { createMemoryRepositories } from './memory.repositories.js';
import { createDemoStore, DEMO_LOGIN } from './demo-data.js';
import { DemoWhatsAppGateway } from './demo-gateway.js';

const PORT = Number(process.env.DEMO_PORT) || 3191;
const HEARTBEAT_MS = 60 * 1000;

async function main(): Promise<void> {
  // Intervalo da fila menor que o de verdade (8 a 20 s), para o disparo aparecer logo na tela
  process.env.MIN_DELAY_SECONDS = process.env.DEMO_MIN_DELAY_SECONDS || '2';
  process.env.MAX_DELAY_SECONDS = process.env.DEMO_MAX_DELAY_SECONDS || '4';

  const repos = createMemoryRepositories(await createDemoStore());
  const { app } = createApp({
    repositories: repos,
    whatsAppGateway: new DemoWhatsAppGateway(),
    // Segredo novo a cada início: os logins da demonstração valem só enquanto ela está aberta
    jwtSecret: crypto.randomBytes(32).toString('hex'),
  });

  // Mantém o "sinal de vida" da sede em dia, como a máquina-sede faz
  setInterval(() => void repos.sedeStatus.saveHeartbeat('open', new Date()), HEARTBEAT_MS).unref();

  app.listen(PORT, '127.0.0.1', () => {
    console.log('');
    console.log('  Flow-Zap - demonstração (dados fictícios, nada é enviado)');
    console.log(`  API em http://127.0.0.1:${PORT}`);
    console.log('  Painel: rode "npm run demo" dentro de frontend e abra http://localhost:5191');
    console.log(`  Login: ${DEMO_LOGIN.email} / ${DEMO_LOGIN.senha}`);
    console.log('  Os dados voltam ao inicial sempre que este servidor reinicia.');
    console.log('');
  });
}

main().catch((err) => {
  console.error('[demo] não foi possível iniciar:', err);
  process.exit(1);
});
