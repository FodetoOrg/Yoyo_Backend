// @ts-nocheck
import { FastifyRequest, FastifyReply } from 'fastify';
import { RevenueService } from '../services/revenue.service';
import { z } from 'zod';

const revenueFiltersSchema = z.object({
  status: z.enum(['pending', 'paid', 'overdue']).optional(),
  period: z.string().optional(),
  hotelId: z.string().uuid().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(10),
});

const generateRevenueSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/, 'Period must be in YYYY-MM format'),
});

const revenueParamsSchema = z.object({
  id: z.string().uuid(),
});

const updateStatusSchema = z.object({
  status: z.enum(['pending', 'paid', 'overdue']),
});

const markAsPaidSchema = z.object({
  paidDate: z.string().datetime().optional(),
});

export class RevenueController {
  private revenueService: RevenueService;

  constructor() {
    this.revenueService = new RevenueService();
  }

  setFastify(fastify: any) {
    this.revenueService.setFastify(fastify);
  }

  // Get revenue records with filters
  async getRevenueRecords(request: FastifyRequest, reply: FastifyReply) {
    try {
      const filters = revenueFiltersSchema.parse(request.query);
      const result = await this.revenueService.getRevenueRecords(filters);
      
      return reply.code(200).send({
        success: true,
        data: result,
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
        message: error.message || 'Failed to fetch revenue records',
      });
    }
  }

  // Get revenue record by ID
  async getRevenueRecordById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = revenueParamsSchema.parse(request.params);
      const record = await this.revenueService.getRevenueRecordById(id);
      
      return reply.code(200).send({
        success: true,
        data: record,
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
        message: error.message || 'Failed to fetch revenue record',
      });
    }
  }

  // Generate revenue records for a period
  async generateRevenueRecords(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { period } = generateRevenueSchema.parse(request.body);
      const result = await this.revenueService.generateRevenueRecords(period);
      
      return reply.code(201).send({
        success: true,
        message: 'Revenue records generated successfully',
        data: result,
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
        message: error.message || 'Failed to generate revenue records',
      });
    }
  }

  // Mark revenue record as paid
  async markAsPaid(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = revenueParamsSchema.parse(request.params);
      const { paidDate } = markAsPaidSchema.parse(request.body);
      
      const processedPaidDate = paidDate ? new Date(paidDate) : undefined;
      const record = await this.revenueService.markAsPaid(id, processedPaidDate);
      
      return reply.code(200).send({
        success: true,
        message: 'Revenue record marked as paid',
        data: record,
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
        message: error.message || 'Failed to mark as paid',
      });
    }
  }

  // Update revenue record status
  async updateStatus(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = revenueParamsSchema.parse(request.params);
      const { status } = updateStatusSchema.parse(request.body);
      
      const record = await this.revenueService.updateStatus(id, status);
      
      return reply.code(200).send({
        success: true,
        message: 'Revenue record status updated',
        data: record,
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
        message: error.message || 'Failed to update status',
      });
    }
  }

  // Get revenue summary
  async getRevenueSummary(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { hotelId } = request.query as { hotelId?: string };
      const summary = await this.revenueService.getRevenueSummary(hotelId);
      
      return reply.code(200).send({
        success: true,
        data: summary,
      });
    } catch (error) {
      request.log.error(error);
      
      return reply.code(500).send({
        success: false,
        message: error.message || 'Failed to fetch revenue summary',
      });
    }
  }
}