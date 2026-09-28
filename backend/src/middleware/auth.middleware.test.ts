import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { createAuthMiddleware, AuthenticatedRequest } from './auth.middleware.js';
import { AuthService } from '../services/auth.service.js';
import { IUserRepository } from '../repositories/user.repository.interface.js';

describe('Auth Middleware (TDD)', () => {
  let authService: AuthService;
  let mockUserRepo: IUserRepository;
  let authMiddleware: (req: Request, res: Response, next: NextFunction) => void;
  let mockReq: Partial<AuthenticatedRequest>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockUserRepo = {
      findByEmail: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
    };
    authService = new AuthService(mockUserRepo, 'test_jwt_secret_middleware_12345');
    authMiddleware = createAuthMiddleware(authService);

    mockReq = {
      headers: {},
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    mockNext = vi.fn();
  });

  it('should return 401 if Authorization header is missing', () => {
    mockReq.headers = {};

    authMiddleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Token de autenticação não fornecido' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 401 if Authorization header does not start with Bearer', () => {
    mockReq.headers = { authorization: 'Basic 12345' };

    authMiddleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Formato de token inválido' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 401 if token is invalid or expired', () => {
    mockReq.headers = { authorization: 'Bearer invalid_or_expired_token' };

    authMiddleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Token inválido ou expirado' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should attach user payload to req.user and call next() on valid token', () => {
    // Generate valid token
    const validToken = (authService as any).jwtSecret;
    // Use authService.login mock or create signed token
    const token = (authService as any).jwtSecret;
    // Let's create a token using authService
    vi.spyOn(authService, 'verifyToken').mockReturnValue({
      id: 'user-123',
      nome: 'Dono',
      email: 'admin@flowzap.com',
    });

    mockReq.headers = { authorization: 'Bearer valid_mocked_token' };

    authMiddleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect((mockReq as AuthenticatedRequest).user).toEqual({
      id: 'user-123',
      nome: 'Dono',
      email: 'admin@flowzap.com',
    });
  });
});
