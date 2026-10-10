/** Avisos de cobrança cujo texto o usuário pode personalizar. */
export const TIPOS_AVISO = ['lembrete_3d', 'lembrete_2d', 'lembrete_1d', 'vencido'] as const;
export type TipoAviso = (typeof TIPOS_AVISO)[number];

export type MensagensPersonalizadas = Partial<Record<TipoAviso, string>>;

export interface Configuracao {
  /** Quando false, a máquina-sede não envia os avisos sozinha (o disparo manual continua). */
  envio_automatico: boolean;
  /** Textos escritos pelo usuário; o aviso sem texto próprio usa a mensagem padrão. */
  mensagens: MensagensPersonalizadas;
  /** Chave Pix da loja, usada na variável {pix} das mensagens. */
  chave_pix?: string | null;
}

/**
 * Configurações do sistema, gravadas no Supabase para valerem tanto no painel online
 * quanto na máquina-sede (que é quem envia).
 */
export interface IConfiguracaoRepository {
  get(): Promise<Configuracao | null>;
  save(config: Configuracao): Promise<Configuracao>;
}
