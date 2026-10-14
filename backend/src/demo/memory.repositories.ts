import { AppRepositories } from '../create-app.js';
import { User, CreateUserData, IUserRepository } from '../repositories/user.repository.interface.js';
import { ClienteWithStats, IClienteRepository } from '../repositories/cliente.repository.interface.js';
import { DashboardMetrics, IVendaRepository, VendaWithCliente } from '../repositories/venda.repository.interface.js';
import {
  HistoricoMensagem,
  HistoricoWithVendaCliente,
  IHistoricoRepository,
  TipoMensagem,
} from '../repositories/historico.repository.interface.js';
import { IContaPagarRepository } from '../repositories/conta-pagar.repository.interface.js';
import { ISedeStatusRepository, SedeStatusRecord } from '../repositories/sede-status.repository.interface.js';
import { Configuracao, IConfiguracaoRepository } from '../repositories/configuracao.repository.interface.js';
import { BackupRow, BackupTable, IBackupRepository } from '../repositories/backup.repository.interface.js';
import { ClienteDTO, CreateClienteDTO, UpdateClienteDTO } from '../schemas/cliente.schema.js';
import { CreateVendaDTO, UpdateVendaDTO, VendaDTO, VendaStatus } from '../schemas/venda.schema.js';
import { ContaPagarDTO, CreateContaPagarDTO, UpdateContaPagarDTO } from '../schemas/conta-pagar.schema.js';
import { WhatsAppConnectionState } from '../services/whatsapp-gateway.interface.js';

export type ClienteRow = ClienteDTO & { id: number; criado_em: string };
export type VendaRow = VendaDTO & { id: number; criado_em: string };
export type HistoricoRow = HistoricoMensagem & { id: number; data_envio: string };
export type ContaRow = ContaPagarDTO & { id: number };

/** Os dados da demonstração: vivem só na memória do processo e somem ao reiniciar. */
export interface MemoryStore {
  usuarios: User[];
  clientes: ClienteRow[];
  vendas: VendaRow[];
  historico: HistoricoRow[];
  contas: ContaRow[];
  sede: SedeStatusRecord;
  configuracao: Configuracao | null;
}

export function createEmptyStore(): MemoryStore {
  return {
    usuarios: [],
    clientes: [],
    vendas: [],
    historico: [],
    contas: [],
    sede: { estado_whatsapp: 'open', atualizado_em: null, ultima_rotina_data: null, ultimo_backup_em: null, sede_id: null, sede_nome: null },
    configuracao: null,
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;
// Mesma janela do repositório do Supabase: avisos de um ciclo saem até 3 dias antes do vencimento
const CYCLE_WINDOW_DAYS = 20;

/** Cópia profunda: quem recebe um registro não altera o que está guardado. */
const copy = <T>(value: T): T => structuredClone(value);
const nextId = (rows: Array<{ id: number }>) => rows.reduce((max, r) => Math.max(max, r.id), 0) + 1;
const contains = (text: string, search?: string) => !search || text.toLowerCase().includes(search.toLowerCase());

function findOrFail<T extends { id: number }>(rows: T[], id: number, what: string): T {
  const row = rows.find((r) => r.id === id);
  if (!row) throw new Error(`${what} não encontrado(a)`);
  return row;
}

function removeById<T extends { id: number }>(rows: T[], id: number): void {
  const i = rows.findIndex((r) => r.id === id);
  if (i >= 0) rows.splice(i, 1);
}

class MemoryUserRepository implements IUserRepository {
  constructor(private store: MemoryStore) {}

  async findByEmail(email: string): Promise<User | null> {
    return copy(this.store.usuarios.find((u) => u.email === email) ?? null);
  }

  async findById(id: string): Promise<User | null> {
    return copy(this.store.usuarios.find((u) => u.id === id) ?? null);
  }

  async create(data: CreateUserData): Promise<User> {
    const user: User = { id: `demo-${this.store.usuarios.length + 1}`, ativo: true, ...data };
    this.store.usuarios.push(user);
    return copy(user);
  }
}

class MemoryClienteRepository implements IClienteRepository {
  constructor(private store: MemoryStore) {}

  async findAll(search?: string): Promise<ClienteWithStats[]> {
    return this.store.clientes
      .filter((c) => contains(c.nome, search))
      .sort((a, b) => a.nome.localeCompare(b.nome))
      .map((c) => ({
        ...copy(c),
        vendas_ativas_count: this.store.vendas.filter((v) => v.cliente_id === c.id && v.ativo).length,
      }));
  }

  async findById(id: number): Promise<ClienteDTO | null> {
    return copy(this.store.clientes.find((c) => c.id === id) ?? null);
  }

  async create(data: CreateClienteDTO): Promise<ClienteDTO> {
    const row: ClienteRow = { observacoes: null, ...data, ativo: data.ativo ?? true, id: nextId(this.store.clientes), criado_em: new Date().toISOString() };
    this.store.clientes.push(row);
    return copy(row);
  }

  async update(id: number, data: UpdateClienteDTO): Promise<ClienteDTO> {
    const row = findOrFail(this.store.clientes, id, 'Cliente');
    Object.assign(row, data);
    return copy(row);
  }

  async delete(id: number): Promise<void> {
    removeById(this.store.clientes, id);
  }
}

class MemoryVendaRepository implements IVendaRepository {
  constructor(private store: MemoryStore) {}

  private withCliente(v: VendaRow): VendaWithCliente {
    const c = this.store.clientes.find((x) => x.id === v.cliente_id);
    return { ...copy(v), cliente: c ? { id: c.id, nome: c.nome, whatsapp: c.whatsapp, ativo: c.ativo } : null };
  }

  private sorted(rows: VendaRow[]): VendaRow[] {
    return [...rows].sort((a, b) => (a.data_vencimento_atual ?? '').localeCompare(b.data_vencimento_atual ?? ''));
  }

  async findByClienteId(clienteId: number): Promise<VendaDTO[]> {
    return copy(this.store.vendas.filter((v) => v.cliente_id === clienteId));
  }

  async findById(id: number): Promise<VendaWithCliente | null> {
    const v = this.store.vendas.find((x) => x.id === id);
    return v ? this.withCliente(v) : null;
  }

  async findActiveVendas(): Promise<VendaWithCliente[]> {
    // Como o join "inner" do Supabase: venda sem cadastro e cliente inativo ficam de fora
    return this.sorted(this.store.vendas)
      .map((v) => this.withCliente(v))
      .filter((v) => v.ativo && v.cliente?.ativo);
  }

  async findAllVendas(): Promise<VendaWithCliente[]> {
    return this.sorted(this.store.vendas).map((v) => this.withCliente(v));
  }

  async create(data: CreateVendaDTO): Promise<VendaDTO> {
    const row: VendaRow = {
      cliente_id: null,
      cliente_avulso: null,
      observacoes: null,
      status_mes_atual: 'pendente',
      ...data,
      parcela_atual: data.parcela_atual ?? 1,
      ativo: data.ativo ?? true,
      id: nextId(this.store.vendas),
      criado_em: new Date().toISOString(),
    };
    this.store.vendas.push(row);
    return copy(row);
  }

  async update(id: number, data: UpdateVendaDTO): Promise<VendaDTO> {
    const row = findOrFail(this.store.vendas, id, 'Venda');
    Object.assign(row, data);
    return copy(row);
  }

  async updateStatus(id: number, status: VendaStatus, nextDueDate?: string): Promise<VendaDTO> {
    const row = findOrFail(this.store.vendas, id, 'Venda');
    row.status_mes_atual = status;
    if (nextDueDate) row.data_vencimento_atual = nextDueDate;
    return copy(row);
  }

  async getDashboardMetrics(): Promise<DashboardMetrics> {
    const ativas = this.store.vendas.filter((v) => v.ativo);
    const com = (...status: VendaStatus[]) => ativas.filter((v) => status.includes(v.status_mes_atual));
    const soma = (rows: VendaRow[]) => rows.reduce((acc, v) => acc + Number(v.valor || 0), 0);
    return {
      totalPendentes: com('pendente').length,
      totalAvisados: com('avisado_3d', 'avisado_1d').length,
      totalVencidos: com('vencido').length,
      totalPagos: com('pago').length,
      valorTotalMensal: soma(ativas),
      valorTotalRecebido: soma(com('pago')),
    };
  }
}

class MemoryHistoricoRepository implements IHistoricoRepository {
  constructor(private store: MemoryStore) {}

  private recentFirst(rows: HistoricoRow[]): HistoricoRow[] {
    return [...rows].sort((a, b) => b.data_envio.localeCompare(a.data_envio));
  }

  private withVenda(h: HistoricoRow): HistoricoWithVendaCliente {
    const v = this.store.vendas.find((x) => x.id === h.venda_id);
    const c = v ? this.store.clientes.find((x) => x.id === v.cliente_id) : undefined;
    return {
      ...copy(h),
      venda: v
        ? {
            ...copy(v),
            data_vencimento_atual: v.data_vencimento_atual ?? '',
            cliente: c ? { id: c.id, nome: c.nome, whatsapp: c.whatsapp } : null,
          }
        : undefined,
    };
  }

  async findById(id: number): Promise<HistoricoMensagem | null> {
    return copy(this.store.historico.find((h) => h.id === id) ?? null);
  }

  async findByVendaId(vendaId: number): Promise<HistoricoMensagem[]> {
    return copy(this.recentFirst(this.store.historico.filter((h) => h.venda_id === vendaId)));
  }

  async findRecentEnviados(limit: number = 50): Promise<HistoricoWithVendaCliente[]> {
    return this.recentFirst(this.store.historico.filter((h) => h.status_envio === 'enviado'))
      .slice(0, limit)
      .map((h) => this.withVenda(h));
  }

  async findPagamentos(limit: number = 100): Promise<HistoricoWithVendaCliente[]> {
    return this.recentFirst(this.store.historico.filter((h) => h.tipo === 'confirmacao_manual'))
      .slice(0, limit)
      .map((h) => this.withVenda(h));
  }

  async findPagamentosBetween(start: string, end: string): Promise<HistoricoWithVendaCliente[]> {
    return this.recentFirst(
      this.store.historico.filter((h) => h.tipo === 'confirmacao_manual' && inRange(h.data_envio, start, end))
    ).map((h) => this.withVenda(h));
  }

  async countAvisosBetween(start: string, end: string): Promise<number> {
    return this.store.historico.filter(
      (h) => h.status_envio === 'enviado' && h.tipo !== 'confirmacao_manual' && inRange(h.data_envio, start, end)
    ).length;
  }

  async create(entry: HistoricoMensagem): Promise<HistoricoMensagem> {
    const row: HistoricoRow = {
      ...entry,
      mensagem: entry.mensagem || null,
      detalhes: entry.detalhes || null,
      id: nextId(this.store.historico),
      data_envio: new Date().toISOString(),
    };
    this.store.historico.push(row);
    return copy(row);
  }

  async delete(id: number): Promise<void> {
    removeById(this.store.historico, id);
  }

  async hasMessageBeenSentForCycle(vendaId: number, tipo: TipoMensagem, cycleDueDate: string): Promise<boolean> {
    const cycleStart = Date.parse(cycleDueDate) - CYCLE_WINDOW_DAYS * DAY_MS;
    return this.store.historico.some(
      (h) => h.venda_id === vendaId && h.tipo === tipo && h.status_envio === 'enviado' && Date.parse(h.data_envio) >= cycleStart
    );
  }
}

const inRange = (at: string, start: string, end: string) => {
  const t = Date.parse(at);
  return t >= Date.parse(start) && t < Date.parse(end);
};

class MemoryContaPagarRepository implements IContaPagarRepository {
  constructor(private store: MemoryStore) {}

  async findAll(search?: string): Promise<ContaPagarDTO[]> {
    return copy(
      this.store.contas
        .filter((c) => contains(`${c.nome_credor} ${c.descricao ?? ''}`, search))
        .sort((a, b) => a.id - b.id)
    );
  }

  async findById(id: number): Promise<ContaPagarDTO | null> {
    return copy(this.store.contas.find((c) => c.id === id) ?? null);
  }

  async create(data: CreateContaPagarDTO): Promise<ContaPagarDTO> {
    const agora = new Date().toISOString();
    const row: ContaRow = { ...data, pago: data.pago ?? false, id: nextId(this.store.contas), criado_em: agora, atualizado_em: agora };
    this.store.contas.push(row);
    return copy(row);
  }

  async update(id: number, data: UpdateContaPagarDTO): Promise<ContaPagarDTO> {
    const row = findOrFail(this.store.contas, id, 'Conta');
    Object.assign(row, data, { atualizado_em: new Date().toISOString() });
    return copy(row);
  }

  async delete(id: number): Promise<void> {
    removeById(this.store.contas, id);
  }

  async getTotalPendente(): Promise<number> {
    return this.store.contas.filter((c) => !c.pago).reduce((acc, c) => acc + Number(c.valor), 0);
  }
}

class MemorySedeStatusRepository implements ISedeStatusRepository {
  constructor(private store: MemoryStore) {}

  async getStatus(): Promise<SedeStatusRecord | null> {
    return copy(this.store.sede);
  }

  async saveHeartbeat(state: WhatsAppConnectionState, at: Date): Promise<void> {
    this.store.sede.estado_whatsapp = state;
    this.store.sede.atualizado_em = at.toISOString();
  }

  async markRoutineRun(date: string): Promise<void> {
    this.store.sede.ultima_rotina_data = date;
  }

  async markBackup(at: Date): Promise<void> {
    this.store.sede.ultimo_backup_em = at.toISOString();
  }

  async claimSede(sedeId: string, nome: string, force: boolean): Promise<boolean> {
    const dono = this.store.sede.sede_id;
    if (!force && dono && dono !== sedeId) return false;
    this.store.sede.sede_id = sedeId;
    this.store.sede.sede_nome = nome;
    return true;
  }
}

class MemoryConfiguracaoRepository implements IConfiguracaoRepository {
  constructor(private store: MemoryStore) {}

  async get(): Promise<Configuracao | null> {
    return copy(this.store.configuracao);
  }

  async save(config: Configuracao): Promise<Configuracao> {
    this.store.configuracao = copy(config);
    return copy(config);
  }
}

class MemoryBackupRepository implements IBackupRepository {
  constructor(private store: MemoryStore) {}

  async exportTable(table: BackupTable): Promise<BackupRow[]> {
    const rows: Record<BackupTable, unknown[]> = {
      clientes: this.store.clientes,
      vendas: this.store.vendas,
      historico_mensagens: this.store.historico,
      contas_a_pagar: this.store.contas,
      configuracoes: this.store.configuracao ? [this.store.configuracao] : [],
    };
    return copy(rows[table]) as BackupRow[];
  }

  async importTable(): Promise<void> {
    throw new Error('A restauração de backup não está disponível na demonstração');
  }

  async fixSequences(): Promise<void> {}
}

/** Os repositórios do app, todos sobre o mesmo conjunto de dados em memória. */
export function createMemoryRepositories(store: MemoryStore): AppRepositories {
  return {
    user: new MemoryUserRepository(store),
    cliente: new MemoryClienteRepository(store),
    venda: new MemoryVendaRepository(store),
    historico: new MemoryHistoricoRepository(store),
    contaPagar: new MemoryContaPagarRepository(store),
    sedeStatus: new MemorySedeStatusRepository(store),
    configuracao: new MemoryConfiguracaoRepository(store),
    backup: new MemoryBackupRepository(store),
  };
}
