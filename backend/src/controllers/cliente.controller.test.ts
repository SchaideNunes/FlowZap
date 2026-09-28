import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import { ClienteController } from './cliente.controller.js';
import { IClienteRepository } from '../repositories/cliente.repository.interface.js';

describe('ClienteController (TDD)', () => {
  let mockClienteRepo: IClienteRepository;
  let controller: ClienteController;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    mockClienteRepo = {
      findAll: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    controller = new ClienteController(mockClienteRepo);

    mockReq = {
      params: {},
      query: {},
      body: {},
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };
  });

  it('should list all clients with search param if provided', async () => {
    mockReq.query = { busca: 'Carlos' };
    const mockList = [
      { id: 1, nome: 'Carlos', whatsapp: '5511999999999', ativo: true, vendas_ativas_count: 2 },
    ];
    vi.mocked(mockClienteRepo.findAll).mockResolvedValue(mockList);

    await controller.list(mockReq as Request, mockRes as Response);

    expect(mockClienteRepo.findAll).toHaveBeenCalledWith('Carlos');
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith(mockList);
  });

  it('should reject invalid client creation payload with 400', async () => {
    mockReq.body = { nome: '', whatsapp: 'invalid' };

    await controller.create(mockReq as Request, mockRes as Response);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Erro de validação' })
    );
  });

  it('should create valid client with 201', async () => {
    mockReq.body = { nome: 'Carlos Silva', whatsapp: '5511999999999' };
    const created = { id: 1, nome: 'Carlos Silva', whatsapp: '5511999999999', ativo: true };
    vi.mocked(mockClienteRepo.create).mockResolvedValue(created);

    await controller.create(mockReq as Request, mockRes as Response);

    expect(mockRes.status).toHaveBeenCalledWith(201);
    expect(mockRes.json).toHaveBeenCalledWith(created);
  });
});
