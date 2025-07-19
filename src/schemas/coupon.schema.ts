import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

// Base schemas
export const CouponMappingSchema = z.object({
  cityIds: z.array(z.string().uuid()).optional(),
  hotelIds: z.array(z.string().uuid()).optional(),
  roomTypeIds: z.array(z.string().uuid()).optional(),
});

export const CouponSchema = z.object({
  id: z.string().uuid(),
  code: z.string().min(1).max(50),
  description: z.string().optional(),
  discountType: z.enum(['percentage', 'fixed']),
  discountValue: z.number().positive(),
  maxDiscountAmount: z.number().positive().optional(),
  minOrderAmount: z.number().min(0),
  validFrom: z.string(),
  validTo: z.string(),
  usageLimit: z.number().int().positive().optional(),
  usedCount: z.number().int().min(0),
  priceIncreasePercentage: z.number().min(0),
  status: z.enum(['active', 'inactive', 'expired']),
  createdAt: z.string(),
  updatedAt: z.string(),
  mappings: z.object({
    cities: z.array(z.object({
      id: z.string().uuid(),
      name: z.string(),
      state: z.string(),
    })),
    hotels: z.array(z.object({
      id: z.string().uuid(),
      name: z.string(),
      city: z.string(),
    })),
    roomTypes: z.array(z.object({
      id: z.string().uuid(),
      name: z.string(),
    })),
  }),
});

// Request schemas
export const CreateCouponRequestSchema = z.object({
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
  mappings: CouponMappingSchema,
});

export const UpdateCouponRequestSchema = CreateCouponRequestSchema.partial();

export const ValidateCouponRequestSchema = z.object({
  code: z.string(),
  hotelId: z.string().uuid(),
  roomTypeId: z.string().uuid(),
  orderAmount: z.number().positive(),
});

export const CouponFiltersSchema = z.object({
  status: z.enum(['active', 'inactive', 'expired']).optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(10),
});

export const CouponParamsSchema = z.object({
  id: z.string().uuid(),
});

// Response schemas
export const CouponResponseSchema = z.object({
  success: z.boolean(),
  data: CouponSchema,
});

export const CouponListResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    coupons: z.array(CouponSchema),
    total: z.number().int().min(0),
    page: z.number().int().min(1),
    limit: z.number().int().min(1),
    totalPages: z.number().int().min(1),
  }),
});

export const ValidateCouponResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    coupon: z.object({
      id: z.string().uuid(),
      code: z.string(),
      discountType: z.enum(['percentage', 'fixed']),
      discountValue: z.number(),
    }),
    discountAmount: z.number(),
    finalAmount: z.number(),
  }),
});

// Fastify schema objects
export const getCouponsSchema = {
  querystring: zodToJsonSchema(CouponFiltersSchema),
  response: {
    200: zodToJsonSchema(CouponListResponseSchema),
  },
  tags: ['coupons'],
  summary: 'Get coupons with filters',
  description: 'Retrieve coupons with optional filtering by status',
};

export const getCouponByIdSchema = {
  params: zodToJsonSchema(CouponParamsSchema),
  response: {
    200: zodToJsonSchema(CouponResponseSchema),
    404: zodToJsonSchema(z.object({
      success: z.boolean(),
      message: z.string(),
    })),
  },
  tags: ['coupons'],
  summary: 'Get coupon by ID',
  description: 'Retrieve a specific coupon by its ID',
};

export const createCouponSchema = {
  body: zodToJsonSchema(CreateCouponRequestSchema),
  response: {
    201: zodToJsonSchema(CouponResponseSchema),
  },
  tags: ['coupons'],
  summary: 'Create a new coupon',
  description: 'Create a new coupon with mapping configurations',
};

export const updateCouponSchema = {
  params: zodToJsonSchema(CouponParamsSchema),
  body: zodToJsonSchema(UpdateCouponRequestSchema),
  response: {
    200: zodToJsonSchema(CouponResponseSchema),


export const getUserCouponsSchema = {
  querystring: zodToJsonSchema(CouponFiltersSchema),
  response: {
    200: zodToJsonSchema(CouponListResponseSchema),
  },
  tags: ['coupons'],
  summary: 'Get all coupons for users',
  description: 'Retrieve all coupons available for users including expired and active ones',
};

  },
  tags: ['coupons'],
  summary: 'Update coupon',
  description: 'Update an existing coupon',
};

export const deleteCouponSchema = {
  params: zodToJsonSchema(CouponParamsSchema),
  response: {
    200: zodToJsonSchema(z.object({
      success: z.boolean(),
      message: z.string(),
    })),
  },
  tags: ['coupons'],
  summary: 'Delete coupon',
  description: 'Delete an existing coupon',
};

export const validateCouponSchema = {
  body: zodToJsonSchema(ValidateCouponRequestSchema),
  response: {
    200: zodToJsonSchema(ValidateCouponResponseSchema),
    400: zodToJsonSchema(z.object({
      success: z.boolean(),
      message: z.string(),
    })),
  },
  tags: ['coupons'],
  summary: 'Validate coupon',
  description: 'Validate a coupon for a specific booking scenario',
};