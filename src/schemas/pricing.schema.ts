import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

// Base schemas
export const PriceAdjustmentSchema = z.object({
  id: z.string().uuid(),
  cities: z.array(z.string()),
  hotels: z.array(z.string().uuid()),
  roomTypes: z.array(z.string().uuid()),
  adjustmentType: z.enum(['percentage', 'fixed']),
  adjustmentValue: z.number(),
  reason: z.string().optional(),
  effectiveDate: z.string().datetime(),
  expiryDate: z.string().datetime().optional(),
  status: z.enum(['active', 'inactive', 'expired']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// Request schemas
export const CreatePriceAdjustmentRequestSchema = z.object({
  cities: z.array(z.string()).optional(),
  hotels: z.array(z.string().uuid()).optional(),
  roomTypes: z.array(z.string().uuid()).optional(),
  adjustmentType: z.enum(['percentage', 'fixed']),
  adjustmentValue: z.number(),
  reason: z.string().optional(),
  effectiveDate: z.string().datetime(),
  expiryDate: z.string().datetime().optional(),
});

export const UpdatePriceAdjustmentRequestSchema = CreatePriceAdjustmentRequestSchema.partial();

export const PriceAdjustmentFiltersSchema = z.object({
  status: z.enum(['active', 'inactive', 'expired']).optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(10),
});

export const PriceAdjustmentParamsSchema = z.object({
  id: z.string().uuid(),
});

export const GetEffectivePriceQuerySchema = z.object({
  roomId: z.string().uuid(),
  bookingDate: z.string().datetime().optional(),
});

// Response schemas
export const PriceAdjustmentResponseSchema = z.object({
  success: z.boolean(),
  data: PriceAdjustmentSchema,
});

export const PriceAdjustmentListResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    adjustments: z.array(PriceAdjustmentSchema),
    total: z.number().int().min(0),
    page: z.number().int().min(1),
    limit: z.number().int().min(1),
    totalPages: z.number().int().min(1),
  }),
});

export const EffectivePriceResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    roomId: z.string().uuid(),
    originalPricePerNight: z.number(),
    originalPricePerHour: z.number().nullable(),
    effectivePricePerNight: z.number(),
    effectivePricePerHour: z.number().nullable(),
    appliedAdjustments: z.number().int(),
  }),
});

// Fastify schema objects
export const createPriceAdjustmentSchema = {
  body: zodToJsonSchema(CreatePriceAdjustmentRequestSchema),
  response: {
    201: zodToJsonSchema(PriceAdjustmentResponseSchema),
  },
  tags: ['pricing'],
  summary: 'Create price adjustment',
  description: 'Create a new price adjustment for cities, hotels, or room types',
};

export const getPriceAdjustmentHistorySchema = {
  querystring: zodToJsonSchema(PriceAdjustmentFiltersSchema),
  response: {
    200: zodToJsonSchema(PriceAdjustmentListResponseSchema),
  },
  tags: ['pricing'],
  summary: 'Get price adjustment history',
  description: 'Retrieve price adjustment history with optional filtering',
};

export const getPriceAdjustmentByIdSchema = {
  params: zodToJsonSchema(PriceAdjustmentParamsSchema),
  response: {
    200: zodToJsonSchema(PriceAdjustmentResponseSchema),
    404: zodToJsonSchema(z.object({
      success: z.boolean(),
      message: z.string(),
    })),
  },
  tags: ['pricing'],
  summary: 'Get price adjustment by ID',
  description: 'Retrieve a specific price adjustment by its ID',
};

export const updatePriceAdjustmentSchema = {
  params: zodToJsonSchema(PriceAdjustmentParamsSchema),
  body: zodToJsonSchema(UpdatePriceAdjustmentRequestSchema),
  response: {
    200: zodToJsonSchema(PriceAdjustmentResponseSchema),
  },
  tags: ['pricing'],
  summary: 'Update price adjustment',
  description: 'Update an existing price adjustment',
};

export const deletePriceAdjustmentSchema = {
  params: zodToJsonSchema(PriceAdjustmentParamsSchema),
  response: {
    200: zodToJsonSchema(z.object({
      success: z.boolean(),
      message: z.string(),
    })),
  },
  tags: ['pricing'],
  summary: 'Delete price adjustment',
  description: 'Delete an existing price adjustment',
};

export const getEffectivePriceSchema = {
  querystring: zodToJsonSchema(GetEffectivePriceQuerySchema),
  response: {
    200: zodToJsonSchema(EffectivePriceResponseSchema),
  },
  tags: ['pricing'],
  summary: 'Get effective price for a room',
  description: 'Calculate the effective price for a room considering all active adjustments',
};