import { Router } from 'express';
import { BackupController } from '../controllers/backup.controller.js';
import { createAuthMiddleware } from '../middleware/auth.middleware.js';
import { AuthService } from '../services/auth.service.js';

export function createBackupRouter(controller: BackupController, authService: AuthService): Router {
  const router = Router();
  const authMiddleware = createAuthMiddleware(authService);

  router.use(authMiddleware);

  router.get('/', controller.download);
  router.get('/status', controller.status);

  return router;
}
