import { FastifyInstance } from 'fastify';
import { CouponController } from '../controllers/coupon.controller';
import { rbacGuard } from '../plugins/rbacGuard';
import { permissions } from '../utils/rbac';

const couponController = new CouponController();

export default async function couponRoutes(fastify: FastifyInstance) {
  // Set fastify instance in the service
  couponController.setFastify(fastify);

  // All coupon routes require authentication
  fastify.addHook('onRequest', fastify.authenticate);

  // Get coupons with filters (Super admin only)
  fastify.get('/', {
    schema: {
      tags: ['coupons'],
      summary: 'Get coupons with filters',
      security: [{ bearerAuth: [] }]
    },
    preHandler: rbacGuard(permissions.viewCoupons)
  }, (request, reply) => couponController.getCoupons(request, reply));

  // Get coupon by ID (Super admin only)
  fastify.get('/:id', {
    schema: {
      tags: ['coupons'],
      summary: 'Get coupon by ID',
      security: [{ bearerAuth: [] }]
    },
    preHandler: rbacGuard(permissions.viewCoupons)
  }, (request, reply) => couponController.getCouponById(request, reply));

  // Create coupon (Super admin only)
  fastify.post('/', {
    schema: {
      tags: ['coupons'],
      summary: 'Create a new coupon',
      security: [{ bearerAuth: [] }]
    },
    preHandler: rbacGuard(permissions.createCoupon)
  }, (request, reply) => couponController.createCoupon(request, reply));

  // Update coupon (Super admin only)
  fastify.put('/:id', {
    schema: {
      tags: ['coupons'],
      summary: 'Update coupon',
      security: [{ bearerAuth: [] }]
    },
    preHandler: rbacGuard(permissions.updateCoupon)
  }, (request, reply) => couponController.updateCoupon(request, reply));

  // Delete coupon (Super admin only)
  fastify.delete('/:id', {
    schema: {
      tags: ['coupons'],
      summary: 'Delete coupon',
      security: [{ bearerAuth: [] }]
    },
    preHandler: rbacGuard(permissions.deleteCoupon)
  }, (request, reply) => couponController.deleteCoupon(request, reply));

  // Validate coupon (Public for booking process)
  fastify.post('/validate', {
    schema: {
      tags: ['coupons'],
      summary: 'Validate coupon for booking',
      security: [{ bearerAuth: [] }]
    }
  }, (request, reply) => couponController.validateCoupon(request, reply));
}