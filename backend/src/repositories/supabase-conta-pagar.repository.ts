import { SupabaseClient } from '@supabase/supabase-js';
import { IContaPagarRepository } from './conta-pagar.repository.interface.js';
import { ContaPagarDTO, CreateContaPagarDTO, UpdateContaPagarDTO } from '../schemas/conta-pagar.schema.js';

export class SupabaseContaPagarRepository implements IContaPagarRepository {
  private client: SupabaseClient;
  // In-memory fallback if the Supabase table hasn't been created yet
  private memoryStore: ContaPagarDTO[] = [
    {
      id: 1,
      nome_credor: 'CRISTE (PARCELADO)',
      descricao: 'Parcelamento fornecedor',
      valor: 7500.0,
      pago: false,
      observacoes: 'Importado da planilha',
      criado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
    },
    {
      id: 2,
      nome_credor: 'JOSA',
      descricao: 'Dívida / Fornecedor',
      valor: 1000.0,
      pago: false,
      observacoes: 'Importado da planilha',
      criado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
    },
  ];
  private nextId = 3;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  private isTableMissingError(error: any): boolean {
    return (
      error &&
      (error.code === 'PGRST205' ||
        error.code === '42P01' ||
        (typeof error.message === 'string' && error.message.includes('does not exist')))
    );
  }

  async findAll(search?: string): Promise<ContaPagarDTO[]> {
    let query = this.client
      .from('contas_a_pagar')
      .select('*')
      .order('id', { ascending: true });

    if (search && search.trim().length > 0) {
      query = query.ilike('nome_credor', `%${search.trim()}%`);
    }

    const { data, error } = await query;
    if (error) {
      if (this.isTableMissingError(error)) {
        let results = [...this.memoryStore];
        if (search && search.trim().length > 0) {
          const s = search.trim().toLowerCase();
          results = results.filter((item) => item.nome_credor.toLowerCase().includes(s));
        }
        return results;
      }
      throw new Error(`Erro ao buscar contas a pagar: ${error.message}`);
    }

    return (data || []) as ContaPagarDTO[];
  }

  async findById(id: number): Promise<ContaPagarDTO | null> {
    const { data, error } = await this.client
      .from('contas_a_pagar')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      if (this.isTableMissingError(error)) {
        const item = this.memoryStore.find((i) => i.id === id);
        return item || null;
      }
      throw new Error(`Erro ao buscar conta a pagar por ID: ${error.message}`);
    }

    return (data as ContaPagarDTO) || null;
  }

  async create(data: CreateContaPagarDTO): Promise<ContaPagarDTO> {
    const { data: created, error } = await this.client
      .from('contas_a_pagar')
      .insert({
        nome_credor: data.nome_credor,
        descricao: data.descricao ?? null,
        valor: data.valor,
        data_vencimento: data.data_vencimento ?? null,
        pago: data.pago ?? false,
        data_pagamento: data.data_pagamento ?? null,
        observacoes: data.observacoes ?? null,
      })
      .select()
      .single();

    if (error) {
      if (this.isTableMissingError(error)) {
        const newItem: ContaPagarDTO = {
          id: this.nextId++,
          nome_credor: data.nome_credor,
          descricao: data.descricao ?? null,
          valor: data.valor,
          data_vencimento: data.data_vencimento ?? null,
          pago: data.pago ?? false,
          data_pagamento: data.data_pagamento ?? null,
          observacoes: data.observacoes ?? null,
          criado_em: new Date().toISOString(),
          atualizado_em: new Date().toISOString(),
        };
        this.memoryStore.push(newItem);
        return newItem;
      }
      throw new Error(`Erro ao criar conta a pagar: ${error.message}`);
    }

    return created as ContaPagarDTO;
  }

  async update(id: number, data: UpdateContaPagarDTO): Promise<ContaPagarDTO> {
    const { data: updated, error } = await this.client
      .from('contas_a_pagar')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (this.isTableMissingError(error)) {
        const index = this.memoryStore.findIndex((i) => i.id === id);
        if (index === -1) {
          throw new Error('Conta a pagar não encontrada');
        }
        const updatedItem = {
          ...this.memoryStore[index],
          ...data,
          atualizado_em: new Date().toISOString(),
        };
        this.memoryStore[index] = updatedItem;
        return updatedItem;
      }
      throw new Error(`Erro ao atualizar conta a pagar: ${error.message}`);
    }

    return updated as ContaPagarDTO;
  }

  async delete(id: number): Promise<void> {
    const { error } = await this.client.from('contas_a_pagar').delete().eq('id', id);
    if (error) {
      if (this.isTableMissingError(error)) {
        this.memoryStore = this.memoryStore.filter((i) => i.id !== id);
        return;
      }
      throw new Error(`Erro ao remover conta a pagar: ${error.message}`);
    }
  }

  async getTotalPendente(): Promise<number> {
    const items = await this.findAll();
    return items
      .filter((item) => !item.pago)
      .reduce((sum, item) => sum + Number(item.valor), 0);
  }
}
