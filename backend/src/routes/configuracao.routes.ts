import { Router } from 'express';
import { ConfiguracaoController } from '../controllers/configuracao.controller.js';
import { createAuthMiddleware } from '../middleware/auth.middleware.js';
import { AuthService } from '../services/auth.service.js';

export function createConfiguracaoRouter(
  controller: ConfiguracaoController,
  authService: AuthService
): Router {
  const router = Router();
  const authMiddleware = createAuthMiddleware(authService);

  router.use(authMiddleware);

  router.get('/', controller.get);
  router.put('/', controller.update);

  return router;
}
