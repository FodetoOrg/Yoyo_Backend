import { FastifyInstance } from 'fastify';
import { AnalyticsController } from '../controllers/analytics.controller';
import {
  getDashboardAnalyticsSchema,
  getCityAnalyticsSchema,
  getRevenueAnalyticsSchema,
} from '../schemas/analytics.schema';
import { rbacGuard } from '../plugins/rbacGuard';
import { permissions } from '../utils/rbac';

const analyticsController = new AnalyticsController();

export default async function analyticsRoutes(fastify: FastifyInstance) {
  // Set fastify instance in the service
  analyticsController.setFastify(fastify);

  // All analytics routes require authentication
  fastify.addHook('onRequest', fastify.authenticate);

  // Get dashboard analytics
  fastify.get('/dashboard', {
    schema: {
      ...getDashboardAnalyticsSchema,
      tags: ['analytics'],
      summary: 'Get dashboard analytics',
      security: [{ bearerAuth: [] }]
    },
    preHandler: rbacGuard(permissions.viewAnalytics)
  }, (request, reply) => analyticsController.getDashboardAnalytics(request, reply));

  // Get city analytics
  fastify.get('/cities/:id', {
    schema: {
      ...getCityAnalyticsSchema,
      tags: ['analytics'],
      summary: 'Get city analytics',
      security: [{ bearerAuth: [] }]
    },
    preHandler: rbacGuard(permissions.viewAnalytics)
  }, (request, reply) => analyticsController.getCityAnalytics(request, reply));

  // Get revenue analytics
  fastify.get('/revenue', {
    schema: {
      ...getRevenueAnalyticsSchema,
      tags: ['analytics'],
      summary: 'Get revenue analytics with time series data',
      security: [{ bearerAuth: [] }]
    },
    preHandler: rbacGuard(permissions.viewAnalytics)
  }, (request, reply) => analyticsController.getRevenueAnalytics(request, reply));
}