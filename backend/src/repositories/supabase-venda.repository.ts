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

  async findAllVendas(): Promise<VendaWithCliente[]> {
    const { data, error } = await this.client
      .from('vendas')
      .select('*, cliente:clientes(id, nome, whatsapp, ativo)')
      .order('data_vencimento_atual', { ascending: true });

    if (error) {
      throw new Error(`Erro ao buscar todas as vendas: ${error.message}`);
    }

    return (data || []) as VendaWithCliente[];
  }

  async create(data: CreateVendaDTO): Promise<VendaDTO> {
    const payload: any = {
      cliente_id: data.cliente_id,
      descricao: data.descricao,
      valor: data.valor,
      dia_vencimento: data.dia_vencimento,
      status_mes_atual: 'pendente',
      data_vencimento_atual: data.data_vencimento_atual,
      ativo: data.ativo ?? true,
    };

    if (data.valor_total !== undefined) payload.valor_total = data.valor_total;
    if (data.taxa_juros !== undefined) payload.taxa_juros = data.taxa_juros;
    if (data.total_parcelas !== undefined) payload.total_parcelas = data.total_parcelas;
    if (data.parcela_atual !== undefined) payload.parcela_atual = data.parcela_atual;

    const { data: created, error } = await this.client
      .from('vendas')
      .insert(payload)
      .select()
      .single();

    if (error) {
      if (error.message.includes('does not exist')) {
        delete payload.valor_total;
        delete payload.taxa_juros;
        delete payload.total_parcelas;
        delete payload.parcela_atual;

        const { data: fallbackCreated, error: fallbackError } = await this.client
          .from('vendas')
          .insert(payload)
          .select()
          .single();

        if (fallbackError) {
          throw new Error(`Erro ao criar venda: ${fallbackError.message}`);
        }
        return fallbackCreated as VendaDTO;
      }
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
      if (error.message.includes('does not exist')) {
        const fallback = { ...data };
        delete fallback.valor_total;
        delete fallback.taxa_juros;
        delete fallback.total_parcelas;
        delete fallback.parcela_atual;

        const { data: fallbackUpdated, error: fallbackError } = await this.client
          .from('vendas')
          .update(fallback)
          .eq('id', id)
          .select()
          .single();

        if (fallbackError) {
          throw new Error(`Erro ao atualizar venda: ${fallbackError.message}`);
        }
        return fallbackUpdated as VendaDTO;
      }
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
