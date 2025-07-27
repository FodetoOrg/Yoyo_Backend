
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

// Base schemas
export const RefundResponseSchema = z.object({
  id: z.string().uuid(),
  bookingId: z.string().uuid(),
  originalPaymentId: z.string().uuid().nullable(),
  userId: z.string().uuid(),
  refundType: z.enum(['cancellation', 'no_show', 'admin_refund']),
  originalAmount: z.number(),
  cancellationFeeAmount: z.number(),
  refundAmount: z.number(),
  cancellationFeePercentage: z.number(),
  refundReason: z.string(),
  status: z.enum(['pending', 'processed', 'failed', 'rejected']),
  refundMethod: z.string().nullable(),
  razorpayRefundId: z.string().nullable(),
  processedBy: z.string().nullable(),
  processedAt: z.string().datetime().nullable(),
  rejectionReason: z.string().nullable(),
  bankDetails: z.string().nullable(),
  expectedProcessingDays: z.number(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

// Create refund request schemas
export const CreateRefundRequestBodySchema = z.object({
  bookingId: z.string().uuid(),
  refundReason: z.string().min(10, 'Refund reason must be at least 10 characters'),
  refundType: z.enum(['cancellation', 'no_show']).default('cancellation')
});

export const CreateRefundRequestResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    refund: RefundResponseSchema,
    refundCalculation: z.object({
      cancellationFeeAmount: z.number(),
      refundAmount: z.number(),
      hoursUntilCheckIn: z.number()
    })
  })
});

// Get refund schemas
export const GetRefundParamsSchema = z.object({
  id: z.string().uuid()
});

export const GetRefundResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    refund: RefundResponseSchema.extend({
      booking: z.object({
        id: z.string().uuid(),
        checkInDate: z.string().datetime(),
        checkOutDate: z.string().datetime(),
        totalAmount: z.number(),
        hotel: z.object({
          name: z.string(),
          city: z.string()
        }),
        room: z.object({
          name: z.string()
        }),
        user: z.object({
          name: z.string(),
          email: z.string(),
          phone: z.string()
        })
      })
    })
  })
});

// Get all refunds schemas
export const GetAllRefundsQuerySchema = z.object({
  status: z.enum(['pending', 'processed', 'failed', 'rejected']).optional(),
  refundType: z.enum(['cancellation', 'no_show', 'admin_refund']).optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(10)
});

export const GetAllRefundsResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    refunds: z.array(RefundResponseSchema.extend({
      booking: z.object({
        id: z.string().uuid(),
        checkInDate: z.string().datetime(),
        checkOutDate: z.string().datetime(),
        totalAmount: z.number(),
        hotel: z.object({
          name: z.string(),
          city: z.string()
        }),
        room: z.object({
          name: z.string()
        }),
        user: z.object({
          name: z.string(),
          email: z.string(),
          phone: z.string()
        })
      })
    })),
    total: z.number().int(),
    page: z.number().int(),
    limit: z.number().int()
  })
});

// Process refund schemas
export const ProcessRefundParamsSchema = z.object({
  id: z.string().uuid()
});

export const ProcessRefundBodySchema = z.object({
  action: z.enum(['approve', 'reject']),
  rejectionReason: z.string().optional(),
  bankDetails: z.string().optional()
});

export const ProcessRefundResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    refund: RefundResponseSchema
  })
});

// Error schemas
export const RefundErrorSchema = z.object({
  success: z.boolean(),
  message: z.string()
});

// Fastify schema objects
export const createRefundRequestSchema = {
  body: zodToJsonSchema(CreateRefundRequestBodySchema),
  response: {
    201: zodToJsonSchema(CreateRefundRequestResponseSchema),
    400: zodToJsonSchema(RefundErrorSchema)
  }
};

export const getRefundSchema = {
  params: zodToJsonSchema(GetRefundParamsSchema),
  response: {
    200: zodToJsonSchema(GetRefundResponseSchema),
    404: zodToJsonSchema(RefundErrorSchema)
  }
};

export const getAllRefundsSchema = {
  querystring: zodToJsonSchema(GetAllRefundsQuerySchema),
  response: {
    200: zodToJsonSchema(GetAllRefundsResponseSchema)
  }
};

export const processRefundSchema = {
  params: zodToJsonSchema(ProcessRefundParamsSchema),
  body: zodToJsonSchema(ProcessRefundBodySchema),
  response: {
    200: zodToJsonSchema(ProcessRefundResponseSchema),
    404: zodToJsonSchema(RefundErrorSchema)
  }
};
