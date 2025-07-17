import { FastifyRequest, FastifyReply } from 'fastify';
import { CouponService } from '../services/coupon.service';
import { z } from 'zod';

const couponFiltersSchema = z.object({
  status: z.enum(['active', 'inactive', 'expired']).optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(10),
});

const createCouponSchema = z.object({
  code: z.string().min(1).max(50),
  description: z.string().optional(),
  discountType: z.enum(['percentage', 'fixed']),
  discountValue: z.number().positive(),
  maxDiscountAmount: z.number().positive().optional(),
  minOrderAmount: z.number().min(0).default(0),
  validFrom: z.string(),
  validTo: z.string(),
  usageLimit: z.number().int().positive().optional(),
  priceIncreasePercentage: z.number().min(0).default(0),
  mappings: z.object({
    cityIds: z.array(z.string().uuid()).optional(),
    hotelIds: z.array(z.string().uuid()).optional(),
    roomTypeIds: z.array(z.string().uuid()).optional(),
  }),
});

const updateCouponSchema = createCouponSchema.partial();

const couponParamsSchema = z.object({
  id: z.string().uuid(),
});

const validateCouponSchema = z.object({
  code: z.string(),
  hotelId: z.string().uuid(),
  roomTypeId: z.string().uuid(),
  orderAmount: z.number().positive(),
});

export class CouponController {
  private couponService: CouponService;

  constructor() {
    this.couponService = new CouponService();
  }

  setFastify(fastify: any) {
    this.couponService.setFastify(fastify);
  }

  // Get coupons with filters
  async getCoupons(request: FastifyRequest, reply: FastifyReply) {
    try {
      const filters = couponFiltersSchema.parse(request.query);
      const result = await this.couponService.getCoupons(filters);
      
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
        message: error.message || 'Failed to fetch coupons',
      });
    }
  }

  // Get coupon by ID
  async getCouponById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = couponParamsSchema.parse(request.params);
      const coupon = await this.couponService.getCouponById(id);
      
      return reply.code(200).send({
        success: true,
        data: coupon,
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
        message: error.message || 'Failed to fetch coupon',
      });
    }
  }

  // Create coupon
  async createCoupon(request: FastifyRequest, reply: FastifyReply) {
    try {
      const couponData = createCouponSchema.parse(request.body);
      
      const processedData = {
        ...couponData,
        validFrom: new Date(couponData.validFrom),
        validTo: new Date(couponData.validTo),
      };
      
      const couponId = await this.couponService.createCoupon(processedData);
      const coupon = await this.couponService.getCouponById(couponId);
      
      return reply.code(201).send({
        success: true,
        message: 'Coupon created successfully',
        data: coupon,
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
        message: error.message || 'Failed to create coupon',
      });
    }
  }

  // Update coupon
  async updateCoupon(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = couponParamsSchema.parse(request.params);
      const couponData = updateCouponSchema.parse(request.body);
      
      const processedData: any = { ...couponData };
      if (couponData.validFrom) {
        processedData.validFrom = new Date(couponData.validFrom);
      }
      if (couponData.validTo) {
        processedData.validTo = new Date(couponData.validTo);
      }
      
      await this.couponService.updateCoupon(id, processedData);
      const coupon = await this.couponService.getCouponById(id);
      
      return reply.code(200).send({
        success: true,
        message: 'Coupon updated successfully',
        data: coupon,
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
        message: error.message || 'Failed to update coupon',
      });
    }
  }

  // Delete coupon
  async deleteCoupon(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = couponParamsSchema.parse(request.params);
      await this.couponService.deleteCoupon(id);
      
      return reply.code(200).send({
        success: true,
        message: 'Coupon deleted successfully',
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
        message: error.message || 'Failed to delete coupon',
      });
    }
  }

  // Validate coupon
  async validateCoupon(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { code, hotelId, roomTypeId, orderAmount } = validateCouponSchema.parse(request.body);
      const result = await this.couponService.validateCoupon(code, hotelId, roomTypeId, orderAmount);
      
      return reply.code(200).send({
        success: true,
        message: 'Coupon is valid',
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
        message: error.message || 'Coupon validation failed',
      });
    }
  }
}