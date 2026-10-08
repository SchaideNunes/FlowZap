import './config/env.js';
import { app, scheduler } from './app.js';

const port = Number(process.env.PORT) || 3001;
const host = process.env.HOST || '0.0.0.0';

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
