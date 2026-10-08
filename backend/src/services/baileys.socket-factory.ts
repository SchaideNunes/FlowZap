import fs from 'fs';
import path from 'path';
import pino from 'pino';
import { WASocketLike } from './baileys.service.js';

/**
 * Indica se já existe um número pareado (a sessão salva contém o campo "me").
 * Um creds.json recém-criado, sem pareamento, não conta.
 */
export function hasRegisteredSession(authDir: string): boolean {
  try {
    const creds = JSON.parse(fs.readFileSync(path.join(authDir, 'creds.json'), 'utf8'));
    return Boolean(creds?.me);
  } catch {
    return false;
  }
}

export function clearAuthDir(authDir: string): void {
  fs.rmSync(authDir, { recursive: true, force: true });
}

/**
 * Fábrica do socket real do Baileys. O pacote é ESM, então é carregado com import dinâmico
 * apenas na máquina-sede; ele nunca entra no bundle usado pela Vercel.
 */
export function createBaileysSocketFactory(authDir: string): () => Promise<WASocketLike> {
  return async () => {
    const baileys = await import('@whiskeysockets/baileys');
    const makeWASocket = baileys.default;

    const { state, saveCreds } = await baileys.useMultiFileAuthState(authDir);

    let version: [number, number, number] | undefined;
    try {
      ({ version } = await baileys.fetchLatestBaileysVersion());
    } catch {
      // Sem acesso à versão mais recente, usa a versão padrão embutida na biblioteca
    }

    const logger = pino({ level: process.env.WHATSAPP_LOG_LEVEL || 'silent' });

    const sock = makeWASocket({
      version,
      logger,
      auth: {
        creds: state.creds,
        keys: baileys.makeCacheableSignalKeyStore(state.keys, logger),
      },
      // Identificação de aparelho sempre igual, para o WhatsApp ver um único computador
      browser: baileys.Browsers.windows('Chrome'),
      markOnlineOnConnect: false,
      syncFullHistory: false,
    });

    sock.ev.on('creds.update', saveCreds);

    return sock as unknown as WASocketLike;
  };
}
