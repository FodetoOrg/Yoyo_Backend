import { FastifyInstance } from 'fastify';
import { PricingController } from '../controllers/pricing.controller';
import {
  createPriceAdjustmentSchema,
  getPriceAdjustmentHistorySchema,
  getPriceAdjustmentByIdSchema,
  updatePriceAdjustmentSchema,
  deletePriceAdjustmentSchema,
  getEffectivePriceSchema,
} from '../schemas/pricing.schema';
import { rbacGuard } from '../plugins/rbacGuard';
import { permissions } from '../utils/rbac';

const pricingController = new PricingController();

export default async function pricingRoutes(fastify: FastifyInstance) {
  // Set fastify instance in the service
  pricingController.setFastify(fastify);

  // All pricing routes require authentication and super admin access
  fastify.addHook('onRequest', fastify.authenticate);

  // Create price adjustment
  fastify.post('/adjust', {
    schema: {
      ...createPriceAdjustmentSchema,
      tags: ['pricing'],
      summary: 'Create price adjustment',
      security: [{ bearerAuth: [] }]
    },
    preHandler: rbacGuard(permissions.managePricing)
  }, (request, reply) => pricingController.createPriceAdjustment(request, reply));

  // Get price adjustment history
  fastify.get('/history', {
    schema: {
      ...getPriceAdjustmentHistorySchema,
      tags: ['pricing'],
      summary: 'Get price adjustment history',
      security: [{ bearerAuth: [] }]
    },
    preHandler: rbacGuard(permissions.managePricing)
  }, (request, reply) => pricingController.getPriceAdjustmentHistory(request, reply));

  // Get price adjustment by ID
  fastify.get('/:id', {
    schema: {
      ...getPriceAdjustmentByIdSchema,
      tags: ['pricing'],
      summary: 'Get price adjustment by ID',
      security: [{ bearerAuth: [] }]
    },
    preHandler: rbacGuard(permissions.managePricing)
  }, (request, reply) => pricingController.getPriceAdjustmentById(request, reply));

  // Update price adjustment
  fastify.put('/:id', {
    schema: {
      ...updatePriceAdjustmentSchema,
      tags: ['pricing'],
      summary: 'Update price adjustment',
      security: [{ bearerAuth: [] }]
    },
    preHandler: rbacGuard(permissions.managePricing)
  }, (request, reply) => pricingController.updatePriceAdjustment(request, reply));

  // Delete price adjustment
  fastify.delete('/:id', {
    schema: {
      ...deletePriceAdjustmentSchema,
      tags: ['pricing'],
      summary: 'Delete price adjustment',
      security: [{ bearerAuth: [] }]
    },
    preHandler: rbacGuard(permissions.managePricing)
  }, (request, reply) => pricingController.deletePriceAdjustment(request, reply));

  // Get effective price for a room
  fastify.get('/effective-price', {
    schema: {
      ...getEffectivePriceSchema,
      tags: ['pricing'],
      summary: 'Get effective price for a room',
      security: [{ bearerAuth: [] }]
    }
  }, (request, reply) => pricingController.getEffectivePrice(request, reply));
}