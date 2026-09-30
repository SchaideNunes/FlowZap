import { VendaDTO, CreateVendaDTO, UpdateVendaDTO, VendaStatus } from '../schemas/venda.schema.js';

export interface VendaWithCliente extends VendaDTO {
  cliente?: {
    id: number;
    nome: string;
    whatsapp: string;
    ativo: boolean;
  };
}

export interface DashboardMetrics {
  totalPendentes: number;
  totalAvisados: number;
  totalVencidos: number;
  totalPagos: number;
  valorTotalMensal: number;
  valorTotalRecebido: number;
}

export interface IVendaRepository {
  findByClienteId(clienteId: number): Promise<VendaDTO[]>;
  findById(id: number): Promise<VendaWithCliente | null>;
  findActiveVendas(): Promise<VendaWithCliente[]>;
  findAllVendas(): Promise<VendaWithCliente[]>;
  create(data: CreateVendaDTO): Promise<VendaDTO>;
  update(id: number, data: UpdateVendaDTO): Promise<VendaDTO>;
  updateStatus(id: number, status: VendaStatus, nextDueDate?: string): Promise<VendaDTO>;
  getDashboardMetrics(): Promise<DashboardMetrics>;
}
