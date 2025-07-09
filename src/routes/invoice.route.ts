import { FastifyInstance } from 'fastify';
import { InvoiceController } from '../controllers/invoice.controller';
import { rbacGuard } from '../plugins/rbacGuard';
import { permissions } from '../utils/rbac';

const invoiceController = new InvoiceController();

export default async function invoiceRoutes(fastify: FastifyInstance) {
  // Set fastify instance in the service
  invoiceController.setFastify(fastify);

  // All invoice routes require authentication
  fastify.addHook('onRequest', fastify.authenticate);

  // Get invoices with filters
  fastify.get('/', {
    schema: {
      tags: ['invoices'],
      summary: 'Get invoices with filters',
      security: [{ bearerAuth: [] }]
    },
    preHandler: rbacGuard(permissions.viewInvoices)
  }, (request, reply) => invoiceController.getInvoices(request, reply));

  // Get invoice by ID
  fastify.get('/:id', {
    schema: {
      tags: ['invoices'],
      summary: 'Get invoice by ID',
      security: [{ bearerAuth: [] }]
    },
    preHandler: rbacGuard(permissions.viewInvoices)
  }, (request, reply) => invoiceController.getInvoiceById(request, reply));

  // Create invoice
  fastify.post('/', {
    schema: {
      tags: ['invoices'],
      summary: 'Create a new invoice',
      security: [{ bearerAuth: [] }]
    },
    preHandler: rbacGuard(permissions.manageInvoices)
  }, (request, reply) => invoiceController.createInvoice(request, reply));

  // Update invoice status
  fastify.put('/:id/status', {
    schema: {
      tags: ['invoices'],
      summary: 'Update invoice status',
      security: [{ bearerAuth: [] }]
    },
    preHandler: rbacGuard(permissions.manageInvoices)
  }, (request, reply) => invoiceController.updateInvoiceStatus(request, reply));

  // Generate invoice from booking
  fastify.post('/generate', {
    schema: {
      tags: ['invoices'],
      summary: 'Generate invoice from booking',
      security: [{ bearerAuth: [] }]
    },
    preHandler: rbacGuard(permissions.manageInvoices)
  }, (request, reply) => invoiceController.generateInvoiceFromBooking(request, reply));
}