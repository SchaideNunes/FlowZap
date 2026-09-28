import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service.js';
import { LoginSchema } from '../schemas/auth.schema.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';

export class AuthController {
  private authService: AuthService;

  constructor(authService: AuthService) {
    this.authService = authService;
  }

  login = async (req: Request, res: Response): Promise<void> => {
    const parseResult = LoginSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: 'Erro de validação',
        detalhes: parseResult.error.flatten().fieldErrors,
      });
      return;
    }

    try {
      const result = await this.authService.login(parseResult.data);
      res.status(200).json(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro interno ao autenticar';
      res.status(401).json({ error: message });
    }
  };

  me = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }

    res.status(200).json({ user: req.user });
  };
}
