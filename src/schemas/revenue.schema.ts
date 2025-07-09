import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

// Base schemas
export const RevenueRecordSchema = z.object({
  id: z.string().uuid(),
  hotelId: z.string().uuid(),
  period: z.string().regex(/^\d{4}-\d{2}$/, 'Period must be in YYYY-MM format'),
  totalRevenue: z.number().min(0),
  commissionRate: z.number().min(0).max(100),
  commissionAmount: z.number().min(0),
  payableAmount: z.number().min(0),
  status: z.enum(['pending', 'paid', 'overdue']),
  dueDate: z.string().datetime(),
  paidDate: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  hotel: z.object({
    id: z.string().uuid(),
    name: z.string(),
    city: z.string(),
    commissionRate: z.number(),
  }),
});

// Request schemas
export const RevenueFiltersSchema = z.object({
  status: z.enum(['pending', 'paid', 'overdue']).optional(),
  period: z.string().optional(),
  hotelId: z.string().uuid().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(10),
});

export const GenerateRevenueRequestSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/, 'Period must be in YYYY-MM format'),
});

export const MarkAsPaidRequestSchema = z.object({
  paidDate: z.string().datetime().optional(),
});

export const UpdateStatusRequestSchema = z.object({
  status: z.enum(['pending', 'paid', 'overdue']),
});

export const RevenueParamsSchema = z.object({
  id: z.string().uuid(),
});

// Response schemas
export const RevenueRecordResponseSchema = z.object({
  success: z.boolean(),
  data: RevenueRecordSchema,
});

export const RevenueListResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    records: z.array(RevenueRecordSchema),
    total: z.number().int().min(0),
    page: z.number().int().min(1),
    limit: z.number().int().min(1),
    totalPages: z.number().int().min(1),
  }),
});

export const GenerateRevenueResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    period: z.string(),
    generatedCount: z.number().int().min(0),
    recordIds: z.array(z.string().uuid()),
  }),
});

export const RevenueSummaryResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    totalRevenue: z.number(),
    totalCommission: z.number(),
    pendingAmount: z.number(),
    paidAmount: z.number(),
    overdueAmount: z.number(),
    recordCount: z.number().int(),
  }),
});

// Fastify schema objects
export const getRevenueRecordsSchema = {
  querystring: zodToJsonSchema(RevenueFiltersSchema),
  response: {
    200: zodToJsonSchema(RevenueListResponseSchema),
  },
  tags: ['revenue'],
  summary: 'Get revenue records with filters',
  description: 'Retrieve revenue records with optional filtering',
};

export const getRevenueRecordByIdSchema = {
  params: zodToJsonSchema(RevenueParamsSchema),
  response: {
    200: zodToJsonSchema(RevenueRecordResponseSchema),
    404: zodToJsonSchema(z.object({
      success: z.boolean(),
      message: z.string(),
    })),
  },
  tags: ['revenue'],
  summary: 'Get revenue record by ID',
  description: 'Retrieve a specific revenue record by its ID',
};

export const generateRevenueRecordsSchema = {
  body: zodToJsonSchema(GenerateRevenueRequestSchema),
  response: {
    201: zodToJsonSchema(GenerateRevenueResponseSchema),
  },
  tags: ['revenue'],
  summary: 'Generate revenue records for a period',
  description: 'Generate revenue records for all hotels for a specific period',
};

export const markAsPaidSchema = {
  params: zodToJsonSchema(RevenueParamsSchema),
  body: zodToJsonSchema(MarkAsPaidRequestSchema),
  response: {
    200: zodToJsonSchema(RevenueRecordResponseSchema),
  },
  tags: ['revenue'],
  summary: 'Mark revenue record as paid',
  description: 'Mark a revenue record as paid',
};

export const updateStatusSchema = {
  params: zodToJsonSchema(RevenueParamsSchema),
  body: zodToJsonSchema(UpdateStatusRequestSchema),
  response: {
    200: zodToJsonSchema(RevenueRecordResponseSchema),
  },
  tags: ['revenue'],
  summary: 'Update revenue record status',
  description: 'Update the status of a revenue record',
};

export const getRevenueSummarySchema = {
  querystring: zodToJsonSchema(z.object({
    hotelId: z.string().uuid().optional(),
  })),
  response: {
    200: zodToJsonSchema(RevenueSummaryResponseSchema),
  },
  tags: ['revenue'],
  summary: 'Get revenue summary',
  description: 'Get revenue summary statistics',
};