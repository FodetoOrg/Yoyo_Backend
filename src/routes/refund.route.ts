
import { FastifyInstance } from 'fastify';
import { RefundController } from '../controllers/refund.controller';

export async function refundRoutes(fastify: FastifyInstance) {
  const refundController = new RefundController();
  refundController.setFastify(fastify);
  // User routes
  fastify.post('/refunds', {
    onRequest: [fastify.authenticate],
  }, refundController.createRefundRequest.bind(refundController));

  fastify.get('/refunds', {
    onRequest: [fastify.authenticate],
  }, refundController.getUserRefunds.bind(refundController));

  fastify.get('/refunds/:id', {
    onRequest: [fastify.authenticate],
  }, refundController.getRefundById.bind(refundController));

  // Admin routes
  fastify.get('/admin/refunds', {
    onRequest: [fastify.authenticate, 
      // fastify.rbacGuard(['admin'])
  ],
  }, refundController.getAllRefunds.bind(refundController));

  fastify.post('/admin/refunds/:id/process', {
    onRequest: [fastify.authenticate,
      //  fastify.rbacGuard(['admin'])
      ],
  }, refundController.processRefund.bind(refundController));

  fastify.post('/admin/refunds/:id/reject', {
    onRequest: [fastify.authenticate,
      //  fastify.rbacGuard(['admin'])
      ],
  }, refundController.rejectRefund.bind(refundController));
}
