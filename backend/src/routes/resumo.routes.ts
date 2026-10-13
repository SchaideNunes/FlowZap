import { Router } from 'express';
import { ResumoController } from '../controllers/resumo.controller.js';
import { createAuthMiddleware } from '../middleware/auth.middleware.js';
import { AuthService } from '../services/auth.service.js';

export function createResumoRouter(controller: ResumoController, authService: AuthService): Router {
  const router = Router();
  const authMiddleware = createAuthMiddleware(authService);

  router.use(authMiddleware);

  router.get('/mensal', controller.getMensal);

  return router;
}
