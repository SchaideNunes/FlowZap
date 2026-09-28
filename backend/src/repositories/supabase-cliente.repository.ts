import { SupabaseClient } from '@supabase/supabase-js';
import { IClienteRepository, ClienteWithStats } from './cliente.repository.interface.js';
import { ClienteDTO, CreateClienteDTO, UpdateClienteDTO } from '../schemas/cliente.schema.js';

export class SupabaseClienteRepository implements IClienteRepository {
  private client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  async findAll(search?: string): Promise<ClienteWithStats[]> {
    let query = this.client
      .from('clientes')
      .select('*, vendas:vendas(id, ativo)')
      .order('nome', { ascending: true });

    if (search && search.trim().length > 0) {
      query = query.ilike('nome', `%${search.trim()}%`);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Erro ao buscar clientes: ${error.message}`);
    }

    return (data || []).map((row: any) => {
      const activeSales = Array.isArray(row.vendas)
        ? row.vendas.filter((v: any) => v.ativo).length
        : 0;

      return {
        id: row.id,
        nome: row.nome,
        whatsapp: row.whatsapp,
        ativo: row.ativo,
        observacoes: row.observacoes,
        vendas_ativas_count: activeSales,
      };
    });
  }

  async findById(id: number): Promise<ClienteDTO | null> {
    const { data, error } = await this.client
      .from('clientes')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Erro ao buscar cliente por ID: ${error.message}`);
    }

    return data as ClienteDTO | null;
  }

  async create(data: CreateClienteDTO): Promise<ClienteDTO> {
    const { data: created, error } = await this.client
      .from('clientes')
      .insert({
        nome: data.nome,
        whatsapp: data.whatsapp,
        ativo: data.ativo ?? true,
        observacoes: data.observacoes ?? null,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao criar cliente: ${error.message}`);
    }

    return created as ClienteDTO;
  }

  async update(id: number, data: UpdateClienteDTO): Promise<ClienteDTO> {
    const { data: updated, error } = await this.client
      .from('clientes')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao atualizar cliente: ${error.message}`);
    }

    return updated as ClienteDTO;
  }

  async delete(id: number): Promise<void> {
    const { error } = await this.client.from('clientes').delete().eq('id', id);
    if (error) {
      throw new Error(`Erro ao remover cliente: ${error.message}`);
    }
  }
}
