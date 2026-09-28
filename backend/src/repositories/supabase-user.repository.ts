import { SupabaseClient } from '@supabase/supabase-js';
import { IUserRepository, User, CreateUserData } from './user.repository.interface.js';

export class SupabaseUserRepository implements IUserRepository {
  private client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  async findByEmail(email: string): Promise<User | null> {
    const { data, error } = await this.client
      .from('usuarios')
      .select('*')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (error) {
      throw new Error(`Erro ao buscar usuário por email: ${error.message}`);
    }

    return data as User | null;
  }

  async findById(id: string): Promise<User | null> {
    const { data, error } = await this.client
      .from('usuarios')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Erro ao buscar usuário por ID: ${error.message}`);
    }

    return data as User | null;
  }

  async create(userData: CreateUserData): Promise<User> {
    const { data, error } = await this.client
      .from('usuarios')
      .insert({
        nome: userData.nome,
        email: userData.email.toLowerCase(),
        senha_hash: userData.senha_hash,
        ativo: userData.ativo ?? true,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao criar usuário: ${error.message}`);
    }

    return data as User;
  }
}
