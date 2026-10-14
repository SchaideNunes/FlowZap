import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// "vite --mode demo" (npm run demo): painel na porta 5191 ligado ao servidor de demonstração
// (backend: npm run demo), para rodar ao lado do sistema de verdade sem conflito de portas.
export default defineConfig(({ mode }) => {
  const demo = mode === 'demo';
  const port = demo ? 5191 : 5173;
  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port,
      strictPort: demo,
      proxy: {
        '/api': {
          target: process.env.BACKEND_URL || (demo ? 'http://127.0.0.1:3191' : 'http://localhost:3001'),
          changeOrigin: true,
        },
      },
    },
    preview: {
      host: '0.0.0.0',
      port,
    },
  };
});
