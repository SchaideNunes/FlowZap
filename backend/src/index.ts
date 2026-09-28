import dotenv from 'dotenv';
import path from 'path';

// Carrega .env da raiz do projeto ou da pasta backend
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config();

import { createApp } from './app.js';

const port = Number(process.env.PORT) || 3001;
const host = process.env.HOST || '0.0.0.0';

try {
  const { app, scheduler } = createApp();

  // Inicia o servidor HTTP escutando em 0.0.0.0 para acesso via rede local
  const server = app.listen(port, host, () => {
    console.log(`=======================================================`);
    console.log(`🚀 Flow-Zap Backend rodando com sucesso!`);
    console.log(`📡 Local:        http://localhost:${port}`);
    console.log(`🌐 Rede Local:   http://${host}:${port}`);
    console.log(`=======================================================`);
  });

  // Inicia o agendador automático diário de cobranças
  scheduler.start();

  const shutdown = () => {
    console.log('\nEncerrando servidor Flow-Zap com segurança...');
    scheduler.stop();
    server.close(() => {
      console.log('Servidor finalizado.');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
} catch (error) {
  console.error('Falha fatal ao iniciar servidor Flow-Zap:', error);
  process.exit(1);
}
