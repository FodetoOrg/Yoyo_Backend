import { FastifyRequest, FastifyReply } from 'fastify';
import { PricingService } from '../services/pricing.service';
import { z } from 'zod';

const createPriceAdjustmentSchema = z.object({
  cities: z.array(z.string()).optional(),
  hotels: z.array(z.string().uuid()).optional(),
  roomTypes: z.array(z.string().uuid()).optional(),
  adjustmentType: z.enum(['percentage', 'fixed']),
  adjustmentValue: z.number(),
  reason: z.string().optional(),
  effectiveDate: z.string().datetime(),
  expiryDate: z.string().datetime().optional(),
});

const updatePriceAdjustmentSchema = createPriceAdjustmentSchema.partial();

const priceAdjustmentFiltersSchema = z.object({
  status: z.enum(['active', 'inactive', 'expired']).optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(10),
});

const priceAdjustmentParamsSchema = z.object({
  id: z.string().uuid(),
});

const getEffectivePriceSchema = z.object({
  roomId: z.string().uuid(),
  bookingDate: z.string().datetime().optional(),
});

export class PricingController {
  private pricingService: PricingService;

  constructor() {
    this.pricingService = new PricingService();
  }

  setFastify(fastify: any) {
    this.pricingService.setFastify(fastify);
  }

  // Create price adjustment
  async createPriceAdjustment(request: FastifyRequest, reply: FastifyReply) {
    try {
      const adjustmentData = createPriceAdjustmentSchema.parse(request.body);
      
      const processedData = {
        ...adjustmentData,
        effectiveDate: new Date(adjustmentData.effectiveDate),
        expiryDate: adjustmentData.expiryDate ? new Date(adjustmentData.expiryDate) : undefined,
      };
      
      const adjustment = await this.pricingService.createPriceAdjustment(processedData);
      
      return reply.code(201).send({
        success: true,
        message: 'Price adjustment created successfully',
        data: adjustment,
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
        message: error.message || 'Failed to create price adjustment',
      });
    }
  }

  // Get price adjustment by ID
  async getPriceAdjustmentById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = priceAdjustmentParamsSchema.parse(request.params);
      const adjustment = await this.pricingService.getPriceAdjustmentById(id);
      
      return reply.code(200).send({
        success: true,
        data: adjustment,
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
        message: error.message || 'Failed to fetch price adjustment',
      });
    }
  }

  // Get price adjustment history
  async getPriceAdjustmentHistory(request: FastifyRequest, reply: FastifyReply) {
    try {
      const filters = priceAdjustmentFiltersSchema.parse(request.query);
      const result = await this.pricingService.getPriceAdjustmentHistory(filters);
      
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
        message: error.message || 'Failed to fetch price adjustment history',
      });
    }
  }

  // Update price adjustment
  async updatePriceAdjustment(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = priceAdjustmentParamsSchema.parse(request.params);
      const adjustmentData = updatePriceAdjustmentSchema.parse(request.body);
      
      const processedData: any = { ...adjustmentData };
      if (adjustmentData.effectiveDate) {
        processedData.effectiveDate = new Date(adjustmentData.effectiveDate);
      }
      if (adjustmentData.expiryDate) {
        processedData.expiryDate = new Date(adjustmentData.expiryDate);
      }
      
      const adjustment = await this.pricingService.updatePriceAdjustment(id, processedData);
      
      return reply.code(200).send({
        success: true,
        message: 'Price adjustment updated successfully',
        data: adjustment,
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
        message: error.message || 'Failed to update price adjustment',
      });
    }
  }

  // Delete price adjustment
  async deletePriceAdjustment(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = priceAdjustmentParamsSchema.parse(request.params);
      await this.pricingService.deletePriceAdjustment(id);
      
      return reply.code(200).send({
        success: true,
        message: 'Price adjustment deleted successfully',
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
        message: error.message || 'Failed to delete price adjustment',
      });
    }
  }

  // Get effective price for a room
  async getEffectivePrice(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { roomId, bookingDate } = getEffectivePriceSchema.parse(request.query);
      
      const processedBookingDate = bookingDate ? new Date(bookingDate) : new Date();
      const result = await this.pricingService.getEffectivePrice(roomId, processedBookingDate);
      
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
      
      const statusCode = error.statusCode || 500;
      return reply.code(statusCode).send({
        success: false,
        message: error.message || 'Failed to get effective price',
      });
    }
  }
}