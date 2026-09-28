import { Router } from 'express';
import { ClienteController } from '../controllers/cliente.controller.js';
import { createAuthMiddleware } from '../middleware/auth.middleware.js';
import { AuthService } from '../services/auth.service.js';

export function createClienteRouter(
  clienteController: ClienteController,
  authService: AuthService
): Router {
  const router = Router();
  const authMiddleware = createAuthMiddleware(authService);

  router.use(authMiddleware);

  router.get('/', clienteController.list);
  router.get('/:id', clienteController.getById);
  router.post('/', clienteController.create);
  router.put('/:id', clienteController.update);
  router.delete('/:id', clienteController.delete);

  return router;
}
