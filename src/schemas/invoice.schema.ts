import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

// Base schemas
export const InvoiceSchema = z.object({
  id: z.string().uuid(),
  bookingId: z.string().uuid(),
  userId: z.string().uuid(),
  hotelId: z.string().uuid(),
  amount: z.number().positive(),
  tax: z.number().min(0),
  totalAmount: z.number().positive(),
  status: z.enum(['pending', 'paid', 'overdue', 'cancelled']),
  dueDate: z.string().datetime(),
  paidDate: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// Request schemas
export const CreateInvoiceRequestSchema = z.object({
  bookingId: z.string().uuid(),
  userId: z.string().uuid(),
  hotelId: z.string().uuid(),
  amount: z.number().positive(),
  tax: z.number().min(0).optional(),
  dueDate: z.string().datetime(),
});

export const UpdateInvoiceStatusRequestSchema = z.object({
  status: z.enum(['pending', 'paid', 'overdue', 'cancelled']),
  paidDate: z.string().datetime().optional(),
});

export const GenerateInvoiceRequestSchema = z.object({
  bookingId: z.string().uuid(),
});

export const InvoiceFiltersSchema = z.object({
  hotelId: z.string().uuid().optional(),
  status: z.enum(['pending', 'paid', 'overdue', 'cancelled']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(10),
});

export const InvoiceParamsSchema = z.object({
  id: z.string().uuid(),
});

// Response schemas
export const InvoiceResponseSchema = z.object({
  success: z.boolean(),
  data: InvoiceSchema,
});

export const InvoiceListResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    invoices: z.array(InvoiceSchema),
    total: z.number().int().min(0),
    page: z.number().int().min(1),
    limit: z.number().int().min(1),
    totalPages: z.number().int().min(1),
  }),
});

// Fastify schema objects
export const getInvoicesSchema = {
  querystring: zodToJsonSchema(InvoiceFiltersSchema),
  response: {
    200: zodToJsonSchema(InvoiceListResponseSchema),
  },
  tags: ['invoices'],
  summary: 'Get invoices with filters',
  description: 'Retrieve invoices with optional filtering by hotel, status, and date range',
};

export const getInvoiceByIdSchema = {
  params: zodToJsonSchema(InvoiceParamsSchema),
  response: {
    200: zodToJsonSchema(InvoiceResponseSchema),
    404: zodToJsonSchema(z.object({
      success: z.boolean(),
      message: z.string(),
    })),
  },
  tags: ['invoices'],
  summary: 'Get invoice by ID',
  description: 'Retrieve a specific invoice by its ID',
};

export const createInvoiceSchema = {
  body: zodToJsonSchema(CreateInvoiceRequestSchema),
  response: {
    201: zodToJsonSchema(InvoiceResponseSchema),
  },
  tags: ['invoices'],
  summary: 'Create a new invoice',
  description: 'Create a new invoice for a booking',
};

export const updateInvoiceStatusSchema = {
  params: zodToJsonSchema(InvoiceParamsSchema),
  body: zodToJsonSchema(UpdateInvoiceStatusRequestSchema),
  response: {
    200: zodToJsonSchema(InvoiceResponseSchema),
  },
  tags: ['invoices'],
  summary: 'Update invoice status',
  description: 'Update the status of an existing invoice',
};

export const generateInvoiceSchema = {
  body: zodToJsonSchema(GenerateInvoiceRequestSchema),
  response: {
    201: zodToJsonSchema(InvoiceResponseSchema),
  },
  tags: ['invoices'],
  summary: 'Generate invoice from booking',
  description: 'Automatically generate an invoice from a booking',
};