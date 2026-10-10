import {
  Configuracao,
  IConfiguracaoRepository,
  MensagensPersonalizadas,
  TIPOS_AVISO,
} from '../repositories/configuracao.repository.interface.js';
import { UpdateConfiguracaoDTO } from '../schemas/configuracao.schema.js';

function cleanMensagens(raw: unknown): MensagensPersonalizadas {
  const mensagens: MensagensPersonalizadas = {};
  if (!raw || typeof raw !== 'object') return mensagens;

  for (const tipo of TIPOS_AVISO) {
    const texto = (raw as Record<string, unknown>)[tipo];
    if (typeof texto === 'string' && texto.trim()) {
      mensagens[tipo] = texto.trim();
    }
  }
  return mensagens;
}

function cleanPix(raw: unknown): string | null {
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
}

export class ConfiguracaoService {
  private repo: IConfiguracaoRepository;

  constructor(repo: IConfiguracaoRepository) {
    this.repo = repo;
  }

  /**
   * Configuração em vigor. Nunca falha: sem registro (ou sem a tabela) vale o padrão,
   * que é envio automático ligado e mensagens padrão.
   */
  async get(): Promise<Configuracao> {
    try {
      const saved = await this.repo.get();
      return {
        envio_automatico: saved?.envio_automatico !== false,
        mensagens: cleanMensagens(saved?.mensagens),
        chave_pix: cleanPix(saved?.chave_pix),
      };
    } catch {
      return { envio_automatico: true, mensagens: {}, chave_pix: null };
    }
  }

  /**
   * Altera só o que foi enviado. Mensagem vazia ou nula volta para a padrão.
   */
  async update(patch: UpdateConfiguracaoDTO): Promise<Configuracao> {
    const current = await this.get();

    const next: Configuracao = {
      envio_automatico: patch.envio_automatico ?? current.envio_automatico,
      mensagens: cleanMensagens({ ...current.mensagens, ...(patch.mensagens || {}) }),
    };

    // A coluna só entra na gravação quando há chave ou quando ela foi alterada: assim um
    // banco ainda sem a migração da chave Pix continua salvando o resto.
    if (patch.chave_pix !== undefined) {
      next.chave_pix = cleanPix(patch.chave_pix);
    } else if (current.chave_pix) {
      next.chave_pix = current.chave_pix;
    }

    try {
      return await this.repo.save(next);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Não foi possível salvar. Confira se os arquivos database/migration_configuracoes.sql e database/migration_chave_pix.sql já foram executados no Supabase. (${detail})`
      );
    }
  }
}
