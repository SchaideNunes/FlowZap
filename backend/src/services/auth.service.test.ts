import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from './auth.service.js';
import { IUserRepository, User } from '../repositories/user.repository.interface.js';
import bcrypt from 'bcryptjs';

describe('AuthService (TDD)', () => {
  let mockUserRepo: IUserRepository;
  let authService: AuthService;
  const mockJwtSecret = 'test_jwt_secret_must_be_long_enough_12345';

  const testUser: User = {
    id: 'user-uuid-123',
    nome: 'Dono da Empresa',
    email: 'admin@flowzap.com',
    senha_hash: bcrypt.hashSync('FlowZap@2026', 10),
    ativo: true,
    criado_em: new Date().toISOString(),
    atualizado_em: new Date().toISOString(),
  };

  beforeEach(() => {
    mockUserRepo = {
      findByEmail: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
    };
    authService = new AuthService(mockUserRepo, mockJwtSecret);
  });

  describe('Password Hashing & Verification', () => {
    it('should hash a password with bcrypt', async () => {
      const hash = await authService.hashPassword('Secret123!');
      expect(hash).toBeDefined();
      expect(hash).not.toBe('Secret123!');
      const isValid = await bcrypt.compare('Secret123!', hash);
      expect(isValid).toBe(true);
    });

    it('should verify correct password successfully', async () => {
      const hash = await authService.hashPassword('MyPassword123');
      const result = await authService.verifyPassword('MyPassword123', hash);
      expect(result).toBe(true);
    });

    it('should reject invalid password', async () => {
      const hash = await authService.hashPassword('MyPassword123');
      const result = await authService.verifyPassword('WrongPassword', hash);
      expect(result).toBe(false);
    });
  });

  describe('User Login Flow', () => {
    it('should authenticate user and return token and user profile on correct credentials', async () => {
      vi.mocked(mockUserRepo.findByEmail).mockResolvedValue(testUser);

      const result = await authService.login({
        email: 'admin@flowzap.com',
        senha: 'FlowZap@2026',
      });

      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('user');
      expect(result.user.id).toBe(testUser.id);
      expect(result.user.email).toBe(testUser.email);
      expect(result.user.nome).toBe(testUser.nome);
      expect(result.token).toBeTypeOf('string');
    });

    it('should throw an error when email does not exist', async () => {
      vi.mocked(mockUserRepo.findByEmail).mockResolvedValue(null);

      await expect(
        authService.login({
          email: 'unknown@flowzap.com',
          senha: 'FlowZap@2026',
        })
      ).rejects.toThrow('Credenciais inválidas');
    });

    it('should throw an error when password is wrong', async () => {
      vi.mocked(mockUserRepo.findByEmail).mockResolvedValue(testUser);

      await expect(
        authService.login({
          email: 'admin@flowzap.com',
          senha: 'IncorrectPassword',
        })
      ).rejects.toThrow('Credenciais inválidas');
    });

    it('should throw an error if user is deactivated', async () => {
      const inactiveUser: User = { ...testUser, ativo: false };
      vi.mocked(mockUserRepo.findByEmail).mockResolvedValue(inactiveUser);

      await expect(
        authService.login({
          email: 'admin@flowzap.com',
          senha: 'FlowZap@2026',
        })
      ).rejects.toThrow('Usuário inativo');
    });
  });

  describe('Token Verification', () => {
    it('should correctly verify and decode a generated token', async () => {
      vi.mocked(mockUserRepo.findByEmail).mockResolvedValue(testUser);

      const loginResult = await authService.login({
        email: 'admin@flowzap.com',
        senha: 'FlowZap@2026',
      });

      const decoded = authService.verifyToken(loginResult.token);
      expect(decoded.id).toBe(testUser.id);
      expect(decoded.email).toBe(testUser.email);
    });

    it('should throw error when token is invalid or tampered', () => {
      expect(() => authService.verifyToken('invalid.jwt.token')).toThrow();
    });
  });
});
