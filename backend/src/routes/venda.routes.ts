import { Router } from 'express';
import { VendaController } from '../controllers/venda.controller.js';
import { createAuthMiddleware } from '../middleware/auth.middleware.js';
import { AuthService } from '../services/auth.service.js';

export function createVendaRouter(
  vendaController: VendaController,
  authService: AuthService
): Router {
  const router = Router();
  const authMiddleware = createAuthMiddleware(authService);

  router.use(authMiddleware);

  router.get('/', vendaController.getAll);
  router.get('/metrics', vendaController.getMetrics);
  router.get('/pagamentos', vendaController.getPagamentos);
  router.get('/cliente/:clienteId', vendaController.getByCliente);
  router.get('/:id', vendaController.getById);
  router.get('/:id/historico', vendaController.getHistorico);
  router.post('/', vendaController.create);
  router.post('/pagamentos/:id/desfazer', vendaController.undoPayment);
  router.put('/:id', vendaController.update);
  router.patch('/:id/pago', vendaController.markAsPaid);
  router.patch('/:id/status', vendaController.toggleAtivo);

  return router;
}
