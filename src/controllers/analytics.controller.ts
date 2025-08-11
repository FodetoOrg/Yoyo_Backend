// @ts-nocheck
import { FastifyRequest, FastifyReply } from 'fastify';
import { AnalyticsService } from '../services/analytics.service';
import { z } from 'zod';

const dashboardQuerySchema = z.object({
  type: z.enum(['super', 'hotel']),
  hotelId: z.string().uuid().optional(),
});

const cityAnalyticsParamsSchema = z.object({
  id: z.string().uuid(),
});

const revenueAnalyticsQuerySchema = z.object({
  hotelId: z.string().uuid().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  period: z.enum(['daily', 'weekly', 'monthly', 'yearly']).default('monthly'),
});

export class AnalyticsController {
  private analyticsService: AnalyticsService;

  constructor() {
    this.analyticsService = new AnalyticsService();
  }

  setFastify(fastify: any) {
    this.analyticsService.setFastify(fastify);
  }

  // Get dashboard analytics
  async getDashboardAnalytics(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { type, hotelId } = dashboardQuerySchema.parse(request.query);
      
      // Validate hotel admin access
      if (type === 'hotel' && !hotelId) {
        return reply.code(400).send({
          success: false,
          message: 'Hotel ID is required for hotel dashboard',
        });
      }
      
      const analytics = await this.analyticsService.getDashboardAnalytics(type, hotelId);
      
      console.log('analytics ',analytics)
      return reply.code(200).send({
        success: true,
        data: analytics,
      });
    } catch (error) {
      request.log.error(error);
      console.log('error ',error)
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
      }
      
      return reply.code(500).send({
        success: false,
        message: error.message || 'Failed to fetch dashboard analytics',
      });
    }
  }

  // Get city analytics
  async getCityAnalytics(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = cityAnalyticsParamsSchema.parse(request.params);
      const analytics = await this.analyticsService.getCityAnalytics(id);
      console.log('analytics ',analytics)
      return reply.code(200).send({
        success: true,
        data: analytics,
      });
    } catch (error) {
      request.log.error(error);
      
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
      }
      
      const statusCode = error.statusCode || 500;
      return reply.code(statusCode).send({
        success: false,
        message: error.message || 'Failed to fetch city analytics',
      });
    }
  }

  // Get revenue analytics
  async getRevenueAnalytics(request: FastifyRequest, reply: FastifyReply) {
    try {
      const filters = revenueAnalyticsQuerySchema.parse(request.query);
      
      const processedFilters = {
        ...filters,
        startDate: filters.startDate ? new Date(filters.startDate) : undefined,
        endDate: filters.endDate ? new Date(filters.endDate) : undefined,
      };
      
      const analytics = await this.analyticsService.getRevenueAnalytics(processedFilters);
      
      return reply.code(200).send({
        success: true,
        data: analytics,
      });
    } catch (error) {
      request.log.error(error);
      
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
      }
      
      return reply.code(500).send({
        success: false,
        message: error.message || 'Failed to fetch revenue analytics',
      });
    }
  }
}