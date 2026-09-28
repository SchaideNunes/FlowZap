import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import { AuthController } from './auth.controller.js';
import { AuthService } from '../services/auth.service.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';

describe('AuthController (TDD)', () => {
  let authService: AuthService;
  let authController: AuthController;
  let mockReq: Partial<AuthenticatedRequest>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    authService = {
      login: vi.fn(),
      verifyToken: vi.fn(),
      hashPassword: vi.fn(),
      verifyPassword: vi.fn(),
    } as unknown as AuthService;

    authController = new AuthController(authService);

    mockReq = {
      body: {},
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
  });

  describe('POST /api/auth/login', () => {
    it('should return 400 when body does not match schema', async () => {
      mockReq.body = { email: 'not-an-email', senha: '123' };

      await authController.login(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Erro de validação' })
      );
    });

    it('should return 200 and auth payload on successful login', async () => {
      mockReq.body = { email: 'admin@flowzap.com', senha: 'ValidPassword123' };
      const mockResult = {
        token: 'signed.jwt.token',
        user: { id: 'u-1', nome: 'Dono', email: 'admin@flowzap.com' },
      };
      vi.mocked(authService.login).mockResolvedValue(mockResult);

      await authController.login(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(mockResult);
    });

    it('should return 401 when auth service rejects credentials', async () => {
      mockReq.body = { email: 'admin@flowzap.com', senha: 'WrongPassword' };
      vi.mocked(authService.login).mockRejectedValue(new Error('Credenciais inválidas'));

      await authController.login(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Credenciais inválidas' });
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return the current user profile from req.user', async () => {
      mockReq.user = { id: 'u-1', nome: 'Dono', email: 'admin@flowzap.com' };

      await authController.me(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        user: { id: 'u-1', nome: 'Dono', email: 'admin@flowzap.com' },
      });
    });

    it('should return 401 if req.user is undefined', async () => {
      mockReq.user = undefined;

      await authController.me(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Não autenticado' });
    });
  });
});
