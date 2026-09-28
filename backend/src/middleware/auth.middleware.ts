import { Request, Response, NextFunction } from 'express';
import { AuthService, TokenPayload } from '../services/auth.service.js';

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

export function createAuthMiddleware(authService: AuthService) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({ error: 'Token de autenticação não fornecido' });
      return;
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      res.status(401).json({ error: 'Formato de token inválido' });
      return;
    }

    const token = parts[1];

    try {
      const decoded = authService.verifyToken(token);
      req.user = decoded;
      next();
    } catch {
      res.status(401).json({ error: 'Token inválido ou expirado' });
      return;
    }
  };
}
