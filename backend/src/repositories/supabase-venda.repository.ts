import { SupabaseClient } from '@supabase/supabase-js';
import {
  IVendaRepository,
  VendaWithCliente,
  DashboardMetrics,
} from './venda.repository.interface.js';
import { CreateVendaDTO, UpdateVendaDTO, VendaDTO, VendaStatus } from '../schemas/venda.schema.js';

export class SupabaseVendaRepository implements IVendaRepository {
  private client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  async findByClienteId(clienteId: number): Promise<VendaDTO[]> {
    const { data, error } = await this.client
      .from('vendas')
      .select('*')
      .eq('cliente_id', clienteId)
      .order('criado_em', { ascending: false });

    if (error) {
      throw new Error(`Erro ao buscar vendas do cliente: ${error.message}`);
    }

    return (data || []) as VendaDTO[];
  }

  async findById(id: number): Promise<VendaWithCliente | null> {
    const { data, error } = await this.client
      .from('vendas')
      .select('*, cliente:clientes(id, nome, whatsapp, ativo)')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Erro ao buscar venda por ID: ${error.message}`);
    }

    return data as VendaWithCliente | null;
  }

  async findActiveVendas(): Promise<VendaWithCliente[]> {
    const { data, error } = await this.client
      .from('vendas')
      .select('*, cliente:clientes!inner(id, nome, whatsapp, ativo)')
      .eq('ativo', true)
      .eq('clientes.ativo', true)
      .order('data_vencimento_atual', { ascending: true });

    if (error) {
      throw new Error(`Erro ao buscar vendas ativas: ${error.message}`);
    }

    return (data || []) as VendaWithCliente[];
  }

  async create(data: CreateVendaDTO): Promise<VendaDTO> {
    const { data: created, error } = await this.client
      .from('vendas')
      .insert({
        cliente_id: data.cliente_id,
        descricao: data.descricao,
        valor: data.valor,
        dia_vencimento: data.dia_vencimento,
        status_mes_atual: 'pendente',
        data_vencimento_atual: data.data_vencimento_atual,
        ativo: data.ativo ?? true,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao criar venda: ${error.message}`);
    }

    return created as VendaDTO;
  }

  async update(id: number, data: UpdateVendaDTO): Promise<VendaDTO> {
    const { data: updated, error } = await this.client
      .from('vendas')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao atualizar venda: ${error.message}`);
    }

    return updated as VendaDTO;
  }

  async updateStatus(id: number, status: VendaStatus, nextDueDate?: string): Promise<VendaDTO> {
    const payload: Partial<VendaDTO> = {
      status_mes_atual: status,
    };

    if (nextDueDate) {
      payload.data_vencimento_atual = nextDueDate;
    }

    const { data: updated, error } = await this.client
      .from('vendas')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao atualizar status da venda: ${error.message}`);
    }

    return updated as VendaDTO;
  }

  async getDashboardMetrics(): Promise<DashboardMetrics> {
    const { data, error } = await this.client
      .from('vendas')
      .select('status_mes_atual, valor, ativo');

    if (error) {
      throw new Error(`Erro ao calcular métricas do dashboard: ${error.message}`);
    }

    const activeList = (data || []).filter((v: any) => v.ativo);

    const totalPendentes = activeList.filter((v: any) => v.status_mes_atual === 'pendente').length;
    const totalAvisados = activeList.filter((v: any) =>
      ['avisado_3d', 'avisado_1d'].includes(v.status_mes_atual)
    ).length;
    const totalVencidos = activeList.filter((v: any) => v.status_mes_atual === 'vencido').length;
    const totalPagos = activeList.filter((v: any) => v.status_mes_atual === 'pago').length;

    const valorTotalMensal = activeList.reduce(
      (sum: number, v: any) => sum + Number(v.valor || 0),
      0
    );
    const valorTotalRecebido = activeList
      .filter((v: any) => v.status_mes_atual === 'pago')
      .reduce((sum: number, v: any) => sum + Number(v.valor || 0), 0);

    return {
      totalPendentes,
      totalAvisados,
      totalVencidos,
      totalPagos,
      valorTotalMensal,
      valorTotalRecebido,
    };
  }
}
