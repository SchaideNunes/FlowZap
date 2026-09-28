import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { IUserRepository } from '../repositories/user.repository.interface.js';
import { LoginDTO } from '../schemas/auth.schema.js';

export interface TokenPayload {
  id: string;
  nome: string;
  email: string;
}

export interface AuthResult {
  token: string;
  user: {
    id: string;
    nome: string;
    email: string;
  };
}

export class AuthService {
  private userRepo: IUserRepository;
  private jwtSecret: string;
  private jwtExpiresIn: string;

  constructor(userRepo: IUserRepository, jwtSecret: string, jwtExpiresIn: string = '7d') {
    this.userRepo = userRepo;
    this.jwtSecret = jwtSecret;
    this.jwtExpiresIn = jwtExpiresIn;
  }

  async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  async login(credentials: LoginDTO): Promise<AuthResult> {
    const user = await this.userRepo.findByEmail(credentials.email);
    if (!user) {
      throw new Error('Credenciais inválidas');
    }

    if (!user.ativo) {
      throw new Error('Usuário inativo');
    }

    const isMatch = await this.verifyPassword(credentials.senha, user.senha_hash);
    if (!isMatch) {
      throw new Error('Credenciais inválidas');
    }

    const payload: TokenPayload = {
      id: user.id,
      nome: user.nome,
      email: user.email,
    };

    const token = jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn as jwt.SignOptions['expiresIn'],
    });

    return {
      token,
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
      },
    };
  }

  verifyToken(token: string): TokenPayload {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as TokenPayload;
      return decoded;
    } catch {
      throw new Error('Token inválido ou expirado');
    }
  }
}
