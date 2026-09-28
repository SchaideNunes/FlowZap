export interface User {
  id: string;
  nome: string;
  email: string;
  senha_hash: string;
  ativo: boolean;
  criado_em?: string;
  atualizado_em?: string;
}

export interface CreateUserData {
  nome: string;
  email: string;
  senha_hash: string;
  ativo?: boolean;
}

export interface IUserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  create(data: CreateUserData): Promise<User>;
}
