import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { AuthService } from '../services/auth.service.js';
import { createAuthMiddleware } from '../middleware/auth.middleware.js';

export function createAuthRouter(authService: AuthService, authController: AuthController): Router {
  const router = Router();
  const authMiddleware = createAuthMiddleware(authService);

  router.post('/login', authController.login);
  router.get('/me', authMiddleware, authController.me);

  return router;
}
