import dotenv from 'dotenv';
import path from 'path';

// Carrega .env da raiz do projeto ou da pasta backend
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config();

import { createApp } from './app.js';

const port = Number(process.env.PORT) || 3001;
const host = process.env.HOST || '0.0.0.0';

const { app, scheduler } = createApp();

let server: any;

// Inicia o listener HTTP se não estiver em ambiente puramente serverless sem porta
if (!process.env.VERCEL || process.env.PORT) {
  server = app.listen(port, host, () => {
    console.log(`=======================================================`);
    console.log(`🚀 Flow-Zap Backend rodando com sucesso!`);
    console.log(`📡 Local:        http://localhost:${port}`);
    console.log(`🌐 Rede Local:   http://${host}:${port}`);
    console.log(`=======================================================`);
  });
}

// Inicia o agendador automático diário de cobranças se não for serverless efêmero
if (!process.env.VERCEL) {
  scheduler.start();
}

const shutdown = () => {
  console.log('\nEncerrando servidor Flow-Zap com segurança...');
  scheduler.stop();
  if (server) {
    server.close(() => {
      console.log('Servidor finalizado.');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export { app, scheduler };
export default app;
