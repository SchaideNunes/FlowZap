import { ContaPagarDTO, CreateContaPagarDTO, UpdateContaPagarDTO } from '../schemas/conta-pagar.schema.js';

export interface IContaPagarRepository {
  findAll(search?: string): Promise<ContaPagarDTO[]>;
  findById(id: number): Promise<ContaPagarDTO | null>;
  create(data: CreateContaPagarDTO): Promise<ContaPagarDTO>;
  update(id: number, data: UpdateContaPagarDTO): Promise<ContaPagarDTO>;
  delete(id: number): Promise<void>;
  getTotalPendente(): Promise<number>;
}
