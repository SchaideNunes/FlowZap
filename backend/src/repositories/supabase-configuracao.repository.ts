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
      .select('*')
      .eq('id', ROW_ID)
      .maybeSingle();

    if (error) {
      throw new Error(`Erro ao ler as configurações: ${error.message}`);
    }

    if (!data) return null;

    // select('*'): a coluna chave_pix pode ainda não existir (migração pendente)
    return {
      envio_automatico: data.envio_automatico,
      mensagens: data.mensagens,
      chave_pix: data.chave_pix ?? null,
    };
  }

  async save(config: Configuracao): Promise<Configuracao> {
    const { error } = await this.client
      .from(TABLE)
      .upsert({ id: ROW_ID, ...config }, { onConflict: 'id' });

    if (error) {
      throw new Error(`Erro ao gravar as configurações: ${error.message}`);
    }

    return config;
  }
}
