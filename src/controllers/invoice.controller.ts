// @ts-nocheck
import { FastifyRequest, FastifyReply } from 'fastify';
import { InvoiceService } from '../services/invoice.service';
import { z } from 'zod';

const invoiceFiltersSchema = z.object({
  hotelId: z.string().uuid().optional(),
  status: z.enum(['pending', 'paid', 'overdue', 'cancelled']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(10),
});

const createInvoiceSchema = z.object({
  bookingId: z.string().uuid(),
  userId: z.string().uuid(),
  hotelId: z.string().uuid(),
  amount: z.number().positive(),
  tax: z.number().min(0).optional(),
  dueDate: z.string().datetime(),
});

const updateInvoiceStatusSchema = z.object({
  status: z.enum(['pending', 'paid', 'overdue', 'cancelled']),
  paidDate: z.string().datetime().optional(),
});

const invoiceParamsSchema = z.object({
  id: z.string().uuid(),
});

const generateInvoiceSchema = z.object({
  bookingId: z.string().uuid(),
});

export class InvoiceController {
  private invoiceService: InvoiceService;

  constructor() {
    this.invoiceService = new InvoiceService();
  }

  setFastify(fastify: any) {
    this.invoiceService.setFastify(fastify);
  }

  // Get invoices with filters
  async getInvoices(request: FastifyRequest, reply: FastifyReply) {
    try {
      const filters = invoiceFiltersSchema.parse(request.query);
      
      // Convert date strings to Date objects
      const processedFilters = {
        ...filters,
        startDate: filters.startDate ? new Date(filters.startDate) : undefined,
        endDate: filters.endDate ? new Date(filters.endDate) : undefined,
      };
      
      const result = await this.invoiceService.getInvoices(processedFilters);
      
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
        message: error.message || 'Failed to fetch invoices',
      });
    }
  }

  // Get invoice by ID
  async getInvoiceById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = invoiceParamsSchema.parse(request.params);
      const invoice = await this.invoiceService.getInvoiceById(id);
      
      return reply.code(200).send({
        success: true,
        data: invoice,
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
        message: error.message || 'Failed to fetch invoice',
      });
    }
  }

  // Create invoice
  async createInvoice(request: FastifyRequest, reply: FastifyReply) {
    try {
      const invoiceData = createInvoiceSchema.parse(request.body);
      
      const processedData = {
        ...invoiceData,
        dueDate: new Date(invoiceData.dueDate),
      };
      
      const invoice = await this.invoiceService.createInvoice(processedData);
      
      return reply.code(201).send({
        success: true,
        message: 'Invoice created successfully',
        data: invoice,
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
        message: error.message || 'Failed to create invoice',
      });
    }
  }

  // Update invoice status
  async updateInvoiceStatus(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = invoiceParamsSchema.parse(request.params);
      const { status, paidDate } = updateInvoiceStatusSchema.parse(request.body);
      
      const processedPaidDate = paidDate ? new Date(paidDate) : undefined;
      
      const invoice = await this.invoiceService.updateInvoiceStatus(id, status, processedPaidDate);
      
      return reply.code(200).send({
        success: true,
        message: 'Invoice status updated successfully',
        data: invoice,
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
        message: error.message || 'Failed to update invoice status',
      });
    }
  }

  // Generate invoice from booking
  async generateInvoiceFromBooking(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { bookingId } = generateInvoiceSchema.parse(request.body);
      const invoice = await this.invoiceService.generateInvoiceFromBooking(bookingId);
      
      return reply.code(201).send({
        success: true,
        message: 'Invoice generated successfully',
        data: invoice,
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
        message: error.message || 'Failed to generate invoice',
      });
    }
  }
}