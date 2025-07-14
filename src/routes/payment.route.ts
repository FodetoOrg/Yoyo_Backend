import { FastifyInstance } from 'fastify';
import { PaymentController } from '../controllers/payment.controller';
import { rbacGuard } from '../plugins/rbacGuard';
import { permissions } from '../utils/rbac';

const paymentController = new PaymentController();

export default async function paymentRoutes(fastify: FastifyInstance) {
  // Set fastify instance in the service
  paymentController.setFastify(fastify);

  // Create payment order (authenticated users)
  fastify.post('/orders', {
    schema: {
      tags: ['payments'],
      summary: 'Create payment order',
      security: [{ bearerAuth: [] }]
    },
    preHandler: [fastify.authenticate]
  }, (request, reply) => paymentController.createPaymentOrder(request, reply));

  // Verify payment (authenticated users)
  fastify.post('/verify', {
    schema: {
      tags: ['payments'],
      summary: 'Verify payment',
      security: [{ bearerAuth: [] }]
    },
    preHandler: [fastify.authenticate]
  }, (request, reply) => paymentController.verifyPayment(request, reply));

  // Razorpay webhook (no authentication required)
  fastify.post('/webhook', {
    schema: {
      tags: ['payments'],
      summary: 'Handle Razorpay webhook',
    }
  }, (request, reply) => paymentController.handleWebhook(request, reply));

  // Create hotel payment (Super admin only)
  fastify.post('/admin/hotel-payment', {
    schema: {
      tags: ['payments'],
      summary: 'Create hotel payment',
      security: [{ bearerAuth: [] }]
    },
    preHandler: [
      fastify.authenticate,
      rbacGuard(permissions.manageRevenue)
    ]
  }, (request, reply) => paymentController.createHotelPayment(request, reply));

  // Process refund (Super admin only)
  fastify.post('/admin/refund', {
    schema: {
      tags: ['payments'],
      summary: 'Process refund',
      security: [{ bearerAuth: [] }]
    },
    preHandler: [
      fastify.authenticate,
      rbacGuard(permissions.manageRevenue)
    ]
  }, (request, reply) => paymentController.processRefund(request, reply));

  // Get payment history
  fastify.get('/history', {
    schema: {
      tags: ['payments'],
      summary: 'Get payment history',
      security: [{ bearerAuth: [] }]
    },
    preHandler: [fastify.authenticate]
  }, (request, reply) => paymentController.getPaymentHistory(request, reply));

  // Record offline payment
  fastify.post('/offline', {
    schema: {
      tags: ['payments'],
      summary: 'Record offline payment',
      security: [{ bearerAuth: [] }]
    },
    preHandler: [fastify.authenticate]
  }, (request, reply) => paymentController.recordOfflinePayment(request, reply));
}