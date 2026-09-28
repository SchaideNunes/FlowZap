import { ClienteDTO, CreateClienteDTO, UpdateClienteDTO } from '../schemas/cliente.schema.js';

export interface ClienteWithStats extends ClienteDTO {
  vendas_ativas_count: number;
}

export interface IClienteRepository {
  findAll(search?: string): Promise<ClienteWithStats[]>;
  findById(id: number): Promise<ClienteDTO | null>;
  create(data: CreateClienteDTO): Promise<ClienteDTO>;
  update(id: number, data: UpdateClienteDTO): Promise<ClienteDTO>;
  delete(id: number): Promise<void>;
}
