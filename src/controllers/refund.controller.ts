// @ts-nocheck
import { FastifyRequest, FastifyReply } from 'fastify';
import { RefundService } from '../services/refund.service';
import { z } from 'zod';

export class RefundController {
  private refundService: RefundService;

  constructor() {
    this.refundService = new RefundService();
  }

  setFastify(fastify: any) {
    this.refundService.setFastify(fastify);
  }

  // Create refund request
  async createRefundRequest(request: FastifyRequest, reply: FastifyReply) {
    try {
      const schema = z.object({
        bookingId: z.string().uuid(),
        refundReason: z.string().min(10),
        refundType: z.enum(['cancellation', 'no_show']).default('cancellation'),
      });

      const { bookingId, refundReason, refundType } = schema.parse(request.body);
      const userId = (request as any).user.id;

      const result = await this.refundService.createRefundRequest({
        bookingId,
        userId,
        refundReason,
        refundType,
      });

      return reply.code(201).send({
        success: true,
        message: 'Refund request created successfully',
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

      return reply.code(400).send({
        success: false,
        message: (error as any)?.message || 'Failed to create refund request',
      });
    }
  }

  // Get user refunds
  async getUserRefunds(request: FastifyRequest, reply: FastifyReply) {
    try {
      const querySchema = z.object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(10),
      });

      const { page, limit } = querySchema.parse((request as any).query || {});
      const userId = (request as any).user.id;

      const refunds = await this.refundService.getUserRefunds(userId, page, limit);

      return reply.send({
        success: true,
        data: refunds,
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        message: 'Failed to fetch refunds',
      });
    }
  }

  // Get refund by ID
  async getRefundById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const paramsSchema = z.object({ id: z.string().uuid() });
      const { id } = paramsSchema.parse((request as any).params);

      const userId = (request as any).user.id;
      const userRole = (request as any).user.role;

      const refund = await this.refundService.getRefundById(
        id,
        userRole === 'user' ? userId : undefined
      );

      if (!refund) {
        return reply.code(404).send({
          success: false,
          message: 'Refund not found',
        });
      }

      return reply.send({
        success: true,
        data: refund,
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        message: 'Failed to fetch refund',
      });
    }
  }

  // Process refund (Admin only)
  async processRefund(request: FastifyRequest, reply: FastifyReply) {
    try {
      const paramsSchema = z.object({ id: z.string().uuid() });
      const { id } = paramsSchema.parse((request as any).params);

      const processedBy = (request as any).user; // keep as userId for consistency

      const result = await this.refundService.processRefund(id, processedBy);

      return reply.send({
        success: true,
        message: 'Refund processed successfully',
        data: result,
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(400).send({
        success: false,
        message: (error as any)?.message || 'Failed to process refund',
      });
    }
  }

  // Reject refund (Admin only)
  async rejectRefund(request: FastifyRequest, reply: FastifyReply) {
    try {
      const paramsSchema = z.object({ id: z.string().uuid() });
      const bodySchema = z.object({
        rejectionReason: z.string().min(10),
      });

      const { id } = paramsSchema.parse((request as any).params);
      const { rejectionReason } = bodySchema.parse((request as any).body);

      const processedBy = (request as any).user.id;

      const result = await this.refundService.rejectRefund(id, processedBy, rejectionReason);

      return reply.send({
        success: true,
        message: 'Refund rejected successfully',
        data: result,
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(400).send({
        success: false,
        message: (error as any)?.message || 'Failed to reject refund',
      });
    }
  }

  // Get all refunds (Admin only)
  async getAllRefunds(request: FastifyRequest, reply: FastifyReply) {
    try {
      const querySchema = z.object({
        status: z.string().optional(),
        refundType: z.enum(['cancellation', 'no_show']).optional(),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(10),
      });

      const { status, refundType, page, limit } = querySchema.parse((request as any).query || {});

      const refunds = await this.refundService.getAllRefunds({
        status,
        refundType,
        page,
        limit,
      });

      return reply.send({
        success: true,
        data: refunds,
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        message: 'Failed to fetch refunds',
      });
    }
  }
}
