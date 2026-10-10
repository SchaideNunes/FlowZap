import { SupabaseClient } from '@supabase/supabase-js';
import { Configuracao, IConfiguracaoRepository } from './configuracao.repository.interface.js';

const TABLE = 'configuracoes';
const ROW_ID = 1;

export class SupabaseConfiguracaoRepository implements IConfiguracaoRepository {
  private client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  async get(): Promise<Configuracao | null> {
    const { data, error } = await this.client
      .from(TABLE)
      .select('envio_automatico, mensagens')
      .eq('id', ROW_ID)
      .maybeSingle();

    if (error) {
      throw new Error(`Erro ao ler as configurações: ${error.message}`);
    }

    if (!data) return null;

    return { envio_automatico: data.envio_automatico, mensagens: data.mensagens };
  }

  async save(config: Configuracao): Promise<Configuracao> {
    const { error } = await this.client
      .from(TABLE)
      .upsert(
        { id: ROW_ID, envio_automatico: config.envio_automatico, mensagens: config.mensagens },
        { onConflict: 'id' }
      );

    if (error) {
      throw new Error(`Erro ao gravar as configurações: ${error.message}`);
    }

    return config;
  }
}
