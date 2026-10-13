import { ISedeStatusRepository } from '../repositories/sede-status.repository.interface.js';

export interface SedeLockOptions {
  /** Identificador desta instalação (UUID gravado em disco na primeira execução). */
  id: string;
  /** Nome do computador, para mostrar no painel quem é a sede. */
  nome: string;
  /** Chamado quando esta máquina passa a ser (true) ou deixa de ser (false) a sede. */
  onChange?: (holder: boolean) => void;
  log?: (message: string) => void;
}

export interface SedeLockInfo {
  /** false quando o banco ainda não tem a trava (migração pendente): vale o comportamento antigo. */
  disponivel: boolean;
  souSede: boolean;
  /** Quem é a sede no momento, quando não é esta máquina. */
  sedeNome?: string | null;
  sedeVistaEm?: string | null;
}

type State = 'unknown' | 'holder' | 'observer' | 'unavailable';

/**
 * Garante que só uma máquina envie cobranças. A primeira a iniciar com um banco vira a
 * sede; outra que suba depois fica só como painel (não envia, não roda a rotina diária e
 * não grava o sinal de vida) até que alguém escolha, nela, "usar este computador como sede".
 */
export class SedeLockService {
  private repo: ISedeStatusRepository;
  private id: string;
  private nome: string;
  private onChange?: (holder: boolean) => void;
  private log: (message: string) => void;
  private state: State = 'unknown';
  private atual: { nome: string | null; vistaEm: string | null } = { nome: null, vistaEm: null };

  constructor(repo: ISedeStatusRepository, options: SedeLockOptions) {
    this.repo = repo;
    this.id = options.id;
    this.nome = options.nome;
    this.onChange = options.onChange;
    this.log = options.log ?? ((message) => console.warn(`[Sede] ${message}`));
  }

  /** Define quem é avisado quando esta máquina ganha ou perde a trava. */
  setOnChange(onChange: (holder: boolean) => void): void {
    this.onChange = onChange;
  }

  /** Esta máquina pode enviar cobranças agora? Antes da primeira conferência, não. */
  isHolder(): boolean {
    return this.state === 'holder' || this.state === 'unavailable';
  }

  /** Primeira conferência, ao iniciar o sistema. */
  acquire(): Promise<boolean> {
    return this.claim(false);
  }

  /** Conferência periódica: renova a trava ou percebe que outra máquina a tomou. */
  refresh(): Promise<boolean> {
    return this.claim(false);
  }

  /** Decisão de uma pessoa, no painel desta máquina: ela passa a ser a sede. */
  takeOver(): Promise<boolean> {
    return this.claim(true);
  }

  getInfo(): SedeLockInfo {
    const souSede = this.isHolder();
    return {
      disponivel: this.state !== 'unavailable',
      souSede,
      ...(souSede ? {} : { sedeNome: this.atual.nome, sedeVistaEm: this.atual.vistaEm }),
    };
  }

  private async claim(force: boolean): Promise<boolean> {
    const before = this.isHolder();

    try {
      const won = await this.repo.claimSede(this.id, this.nome, force);
      if (won) {
        this.state = 'holder';
      } else {
        this.state = 'observer';
        await this.readCurrentHolder();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (/does not exist|schema cache|column/i.test(message)) {
        // Banco sem a coluna da trava: mantém o comportamento de antes da trava existir
        if (this.state !== 'unavailable') {
          this.log(
            'A trava de sede única não está ativa: execute database/migration_trava_sede.sql no Supabase. ' +
              'Até lá, não inicie o sistema em duas máquinas com o mesmo banco.'
          );
        }
        this.state = 'unavailable';
      } else if (this.state === 'unknown') {
        // Sem conseguir consultar o banco na partida, não assume que é a sede
        this.state = 'observer';
      }
      // Falha passageira com estado já conhecido: fica como estava
    }

    const after = this.isHolder();
    if (after !== before) this.onChange?.(after);
    return after;
  }

  private async readCurrentHolder(): Promise<void> {
    try {
      const record = await this.repo.getStatus();
      this.atual = { nome: record?.sede_nome ?? null, vistaEm: record?.atualizado_em ?? null };
    } catch {
      this.atual = { nome: null, vistaEm: null };
    }
  }
}
