import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

// Base schemas
export const PaymentOrderSchema = z.object({
  id: z.string().uuid(),
  bookingId: z.string().uuid(),
  userId: z.string().uuid(),
  razorpayOrderId: z.string(),
  amount: z.number().positive(),
  currency: z.string(),
  status: z.enum(['created', 'attempted', 'paid', 'failed', 'cancelled']),
  receipt: z.string(),
  expiresAt: z.string().datetime(),
  createdAt: z.string().datetime(),
});

export const PaymentSchema = z.object({
  id: z.string().uuid(),
  bookingId: z.string().uuid(),
  userId: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string(),
  paymentType: z.enum(['full', 'advance', 'remaining', 'partial']),
  paymentMethod: z.string(),
  paymentMode: z.enum(['online', 'offline']),
  razorpayPaymentId: z.string().nullable(),
  razorpayOrderId: z.string().nullable(),
  razorpaySignature: z.string().nullable(),
  offlinePaymentDetails: z.string().nullable(),
  receivedBy: z.string().nullable(),
  receiptNumber: z.string().nullable(),
  status: z.enum(['pending', 'completed', 'failed', 'refunded']),
  transactionDate: z.string().datetime(),
  createdAt: z.string().datetime(),
});

// Request schemas
export const CreatePaymentOrderRequestSchema = z.object({
  bookingId: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string().default('INR'),
});

export const VerifyPaymentRequestSchema = z.object({
  razorpayPaymentId: z.string(),
  razorpayOrderId: z.string(),
  razorpaySignature: z.string(),
});

export const CreateHotelPaymentRequestSchema = z.object({
  type: z.enum(['hotel_payment', 'user_refund']),
  toUserId: z.string().uuid(),
  amount: z.number().positive(),
  method: z.string(),
  reason: z.string().optional(),
  hotelId: z.string().uuid().optional(),
  bookingId: z.string().uuid().optional(),
  revenueRecordId: z.string().uuid().optional(),
  metadata: z.any().optional(),
});

export const ProcessRefundRequestSchema = z.object({
  bookingId: z.string().uuid(),
  amount: z.number().positive(),
  reason: z.string(),
});

export const RecordOfflinePaymentRequestSchema = z.object({
  bookingId: z.string().uuid(),
  amount: z.number().positive(),
  paymentMethod: z.string().min(1),
  receivedBy: z.string().min(1),
  receiptNumber: z.string().optional(),
  transactionDate: z.string().datetime().optional(),
  notes: z.string().optional(),
});

export const PaymentHistoryQuerySchema = z.object({
  bookingId: z.string().uuid().optional(),
  status: z.enum(['pending', 'completed', 'failed', 'refunded']).optional(),
  paymentMode: z.enum(['online', 'offline']).optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(10),
});

// Response schemas
export const PaymentOrderResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    orderId: z.string(),
    amount: z.number(),
    currency: z.string(),
    receipt: z.string(),
  }),
});

export const VerifyPaymentResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    success: z.boolean(),
    paymentId: z.string().uuid(),
    bookingId: z.string().uuid(),
    amount: z.number(),
  }),
});

export const HotelPaymentResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    paymentId: z.string().uuid(),
    status: z.string(),
  }),
});

export const RefundResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    paymentId: z.string().uuid(),
    refundId: z.string(),
    amount: z.number(),
  }),
});

export const OfflinePaymentResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    paymentId: z.string().uuid(),
    bookingId: z.string().uuid(),
    amount: z.number(),
    receiptNumber: z.string(),
    paymentMethod: z.string(),
    status: z.string(),
    isFullPayment: z.boolean(),
    remainingAmount: z.number(),
    transactionDate: z.string().datetime(),
  }),
});

export const PaymentHistoryResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    payments: z.array(PaymentSchema),
    total: z.number().int().min(0),
    page: z.number().int().min(1),
    limit: z.number().int().min(1),
    totalPages: z.number().int().min(1),
  }),
});

// Fastify schema objects
export const createPaymentOrderSchema = {
  body: zodToJsonSchema(CreatePaymentOrderRequestSchema),
  response: {
    201: zodToJsonSchema(PaymentOrderResponseSchema),
    400: zodToJsonSchema(z.object({
      success: z.boolean(),
      message: z.string(),
      errors: z.array(z.any()).optional(),
    })),
  },
  tags: ['payments'],
  summary: 'Create payment order for online payment',
  description: 'Create a Razorpay payment order for a booking',
  security: [{ bearerAuth: [] }]
};

export const verifyPaymentSchema = {
  body: zodToJsonSchema(VerifyPaymentRequestSchema),
  response: {
    200: zodToJsonSchema(VerifyPaymentResponseSchema),
    400: zodToJsonSchema(z.object({
      success: z.boolean(),
      message: z.string(),
    })),
  },
  tags: ['payments'],
  summary: 'Verify online payment',
  description: 'Verify Razorpay payment signature and update booking status',
  security: [{ bearerAuth: [] }]
};

export const createHotelPaymentSchema = {
  body: zodToJsonSchema(CreateHotelPaymentRequestSchema),
  response: {
    201: zodToJsonSchema(HotelPaymentResponseSchema),
    400: zodToJsonSchema(z.object({
      success: z.boolean(),
      message: z.string(),
      errors: z.array(z.any()).optional(),
    })),
  },
  tags: ['payments'],
  summary: 'Create hotel payment (Admin only)',
  description: 'Initiate payment to hotel or refund to user',
  security: [{ bearerAuth: [] }]
};

export const processRefundSchema = {
  body: zodToJsonSchema(ProcessRefundRequestSchema),
  response: {
    200: zodToJsonSchema(RefundResponseSchema),
    400: zodToJsonSchema(z.object({
      success: z.boolean(),
      message: z.string(),
      errors: z.array(z.any()).optional(),
    })),
  },
  tags: ['payments'],
  summary: 'Process refund (Admin only)',
  description: 'Process refund for a booking',
  security: [{ bearerAuth: [] }]
};

export const recordOfflinePaymentSchema = {
  body: zodToJsonSchema(RecordOfflinePaymentRequestSchema),
  response: {
    201: zodToJsonSchema(OfflinePaymentResponseSchema),
    400: zodToJsonSchema(z.object({
      success: z.boolean(),
      message: z.string(),
      errors: z.array(z.any()).optional(),
    })),
  },
  tags: ['payments'],
  summary: 'Record offline payment',
  description: 'Record cash/offline payment received for a booking',
  security: [{ bearerAuth: [] }]
};

export const getPaymentHistorySchema = {
  querystring: zodToJsonSchema(PaymentHistoryQuerySchema),
  response: {
    200: zodToJsonSchema(PaymentHistoryResponseSchema),
  },
  tags: ['payments'],
  summary: 'Get payment history',
  description: 'Get payment history with filters',
  security: [{ bearerAuth: [] }]
};