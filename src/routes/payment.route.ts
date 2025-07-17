import { FastifyInstance } from 'fastify';
import { PaymentController } from '../controllers/payment.controller';
import {
  createPaymentOrderSchema,
  verifyPaymentSchema,
  createHotelPaymentSchema,
  processRefundSchema,
  recordOfflinePaymentSchema,
  getPaymentHistorySchema
} from '../schemas/payment.schema';
import { rbacGuard } from '../plugins/rbacGuard';
import { permissions } from '../utils/rbac';

const paymentController = new PaymentController();

export default async function paymentRoutes(fastify: FastifyInstance) {
  // Set fastify instance in the service
  paymentController.setFastify(fastify);

  // Create payment order (authenticated users)
  fastify.post('/orders', {
    schema: createPaymentOrderSchema,
    preHandler: [fastify.authenticate]
  }, (request, reply) => paymentController.createPaymentOrder(request, reply));

  // Verify payment (authenticated users)
  fastify.post('/verify', {
    schema: verifyPaymentSchema,
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
    schema: createHotelPaymentSchema,
    preHandler: [
      fastify.authenticate,
      rbacGuard(permissions.manageRevenue)
    ]
  }, (request, reply) => paymentController.createHotelPayment(request, reply));

  // Process refund (Super admin only)
  fastify.post('/admin/refund', {
    schema: processRefundSchema,
    preHandler: [
      fastify.authenticate,
      rbacGuard(permissions.manageRevenue)
    ]
  }, (request, reply) => paymentController.processRefund(request, reply));

  // Get payment history
  fastify.get('/history', {
    schema: getPaymentHistorySchema,
    preHandler: [fastify.authenticate]
  }, (request, reply) => paymentController.getPaymentHistory(request, reply));

  fastify.get('/history/:id', {
    schema: getPaymentHistorySchema,
    preHandler: [fastify.authenticate]
  }, (request, reply) => paymentController.getPaymentHistoryForHotel(request, reply));

  // Record offline payment
  fastify.post('/offline', {
    schema: recordOfflinePaymentSchema,
    preHandler: [fastify.authenticate]
  }, (request, reply) => paymentController.recordOfflinePayment(request, reply));
}