// Entrada da Vercel (empacotada pelo esbuild em app.js): o app padrão, com Supabase e sem WhatsApp.
// A montagem fica em create-app.ts, para quem precisa de outra (a sede e a demonstração) não criar esta.
import { createApp } from './create-app.js';

export { createApp } from './create-app.js';
export type { AppRepositories, CreateAppOptions } from './create-app.js';

export const { app, scheduler } = createApp();
export default app;
