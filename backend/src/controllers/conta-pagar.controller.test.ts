import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContaPagarController } from './conta-pagar.controller.js';
import { IContaPagarRepository } from '../repositories/conta-pagar.repository.interface.js';
import { Request, Response } from 'express';

describe('ContaPagarController (TDD)', () => {
  let mockRepo: any;
  let controller: ContaPagarController;
  let req: Partial<Request>;
  let res: Partial<Response>;

  beforeEach(() => {
    mockRepo = {
      findAll: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      getTotalPendente: vi.fn(),
    };
    controller = new ContaPagarController(mockRepo as IContaPagarRepository);

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };
  });

  describe('list', () => {
    it('should return list of contas a pagar with status 200', async () => {
      const mockList = [
        { id: 1, nome_credor: 'CRISTE (PARCELADO)', valor: 7500, pago: false },
      ];
      mockRepo.findAll.mockResolvedValue(mockList);

      req = { query: {} };
      await controller.list(req as Request, res as Response);

      expect(mockRepo.findAll).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockList);
    });
  });

  describe('create', () => {
    it('should validate and create conta a pagar with 201', async () => {
      const payload = {
        nome_credor: 'CRISTE (PARCELADO)',
        valor: 7500,
      };
      const created = { id: 1, ...payload, pago: false };
      mockRepo.create.mockResolvedValue(created);

      req = { body: payload };
      await controller.create(req as Request, res as Response);

      expect(mockRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        nome_credor: 'CRISTE (PARCELADO)',
        valor: 7500,
      }));
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(created);
    });

    it('should reject invalid input with 400', async () => {
      req = { body: { valor: -50 } }; // Missing nome_credor and negative valor
      await controller.create(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update conta a pagar with 200', async () => {
      const updated = { id: 1, nome_credor: 'CRISTE', valor: 7000, pago: true };
      mockRepo.update.mockResolvedValue(updated);

      req = { params: { id: '1' }, body: { pago: true } };
      await controller.update(req as Request, res as Response);

      expect(mockRepo.update).toHaveBeenCalledWith(1, { pago: true });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(updated);
    });
  });

  describe('delete', () => {
    it('should delete and return 204', async () => {
      mockRepo.delete.mockResolvedValue(undefined);

      req = { params: { id: '1' } };
      await controller.delete(req as Request, res as Response);

      expect(mockRepo.delete).toHaveBeenCalledWith(1);
      expect(res.status).toHaveBeenCalledWith(204);
    });
  });
});
