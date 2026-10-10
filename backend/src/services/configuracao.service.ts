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
      };
    } catch {
      return { envio_automatico: true, mensagens: {} };
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

    try {
      return await this.repo.save(next);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Não foi possível salvar. Confira se o arquivo database/migration_configuracoes.sql já foi executado no Supabase. (${detail})`
      );
    }
  }
}
