import { Router } from 'express';
import { CobrancaController } from '../controllers/cobranca.controller.js';
import { createAuthMiddleware } from '../middleware/auth.middleware.js';
import { AuthService } from '../services/auth.service.js';

export function createCobrancaRouter(
  cobrancaController: CobrancaController,
  authService: AuthService
): Router {
  const router = Router();
  const authMiddleware = createAuthMiddleware(authService);

  router.use(authMiddleware);

  router.get('/preview', cobrancaController.preview);
  router.get('/central', cobrancaController.getCentral);
  router.post('/disparar', cobrancaController.disparar);
  router.get('/queue-status', cobrancaController.getQueueStatus);
  router.get('/whatsapp-status', cobrancaController.getWhatsAppStatus);
  router.get('/whatsapp-qrcode', cobrancaController.getWhatsAppQrCode);

  return router;
}
