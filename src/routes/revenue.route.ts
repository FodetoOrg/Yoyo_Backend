import { FastifyInstance } from 'fastify';
import { RevenueController } from '../controllers/revenue.controller';
import { rbacGuard } from '../plugins/rbacGuard';
import { permissions } from '../utils/rbac';

const revenueController = new RevenueController();

export default async function revenueRoutes(fastify: FastifyInstance) {
  // Set fastify instance in the service
  revenueController.setFastify(fastify);

  // All revenue routes require authentication and super admin access
  fastify.addHook('onRequest', fastify.authenticate);

  // Get revenue records with filters
  fastify.get('/', {
    schema: {
      tags: ['revenue'],
      summary: 'Get revenue records with filters',
      security: [{ bearerAuth: [] }]
    },
    preHandler: rbacGuard(permissions.viewRevenue)
  }, (request, reply) => revenueController.getRevenueRecords(request, reply));

  // Get revenue record by ID
  fastify.get('/:id', {
    schema: {
      tags: ['revenue'],
      summary: 'Get revenue record by ID',
      security: [{ bearerAuth: [] }]
    },
    preHandler: rbacGuard(permissions.viewRevenue)
  }, (request, reply) => revenueController.getRevenueRecordById(request, reply));

  // Generate revenue records for a period
  fastify.post('/generate', {
    schema: {
      tags: ['revenue'],
      summary: 'Generate revenue records for a period',
      security: [{ bearerAuth: [] }]
    },
    preHandler: rbacGuard(permissions.manageRevenue)
  }, (request, reply) => revenueController.generateRevenueRecords(request, reply));

  // Mark revenue record as paid
  fastify.post('/:id/pay', {
    schema: {
      tags: ['revenue'],
      summary: 'Mark revenue record as paid',
      security: [{ bearerAuth: [] }]
    },
    preHandler: rbacGuard(permissions.manageRevenue)
  }, (request, reply) => revenueController.markAsPaid(request, reply));

  // Update revenue record status
  fastify.put('/:id/status', {
    schema: {
      tags: ['revenue'],
      summary: 'Update revenue record status',
      security: [{ bearerAuth: [] }]
    },
    preHandler: rbacGuard(permissions.manageRevenue)
  }, (request, reply) => revenueController.updateStatus(request, reply));

  // Get revenue summary
  fastify.get('/summary/overview', {
    schema: {
      tags: ['revenue'],
      summary: 'Get revenue summary',
      security: [{ bearerAuth: [] }]
    },
    preHandler: rbacGuard(permissions.viewRevenue)
  }, (request, reply) => revenueController.getRevenueSummary(request, reply));
}