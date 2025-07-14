import { FastifyRequest, FastifyReply } from 'fastify';
import { PaymentService } from '../services/payment.service';
import { z } from 'zod';

const createPaymentOrderSchema = z.object({
  bookingId: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string().default('INR'),
});

const verifyPaymentSchema = z.object({
  razorpayPaymentId: z.string(),
  razorpayOrderId: z.string(),
  razorpaySignature: z.string(),
});

const createHotelPaymentSchema = z.object({
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

const processRefundSchema = z.object({
  bookingId: z.string().uuid(),
  amount: z.number().positive(),
  reason: z.string(),
});

export class PaymentController {
  private paymentService: PaymentService;

  constructor() {
    this.paymentService = new PaymentService();
  }

  setFastify(fastify: any) {
    this.paymentService.setFastify(fastify);
  }

  // Create payment order
  async createPaymentOrder(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { bookingId, amount, currency } = createPaymentOrderSchema.parse(request.body);
      const userId = (request as any).user.id;

      const order = await this.paymentService.createPaymentOrder({
        bookingId,
        userId,
        amount,
        currency,
      });

      return reply.code(201).send({
        success: true,
        message: 'Payment order created successfully',
        data: order,
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
        message: error.message || 'Failed to create payment order',
      });
    }
  }

  // Verify payment
  async verifyPayment(request: FastifyRequest, reply: FastifyReply) {
    try {
      const paymentData = verifyPaymentSchema.parse(request.body);
      
      const result = await this.paymentService.verifyPayment(paymentData);

      return reply.code(200).send({
        success: true,
        message: 'Payment verified successfully',
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
        message: error.message || 'Payment verification failed',
      });
    }
  }

  // Handle Razorpay webhook
  async handleWebhook(request: FastifyRequest, reply: FastifyReply) {
    try {
      const signature = request.headers['x-razorpay-signature'] as string;
      const payload = JSON.stringify(request.body);

      await this.paymentService.handleWebhook(signature, payload);

      return reply.code(200).send({ success: true });
    } catch (error) {
      request.log.error(error);
      return reply.code(400).send({
        success: false,
        message: error.message || 'Webhook processing failed',
      });
    }
  }

  // Create hotel payment (Super admin only)
  async createHotelPayment(request: FastifyRequest, reply: FastifyReply) {
    try {
      const paymentData = createHotelPaymentSchema.parse(request.body);
      const fromUserId = (request as any).user.id;

      const result = await this.paymentService.createHotelPayment({
        ...paymentData,
        fromUserId,
      });

      return reply.code(201).send({
        success: true,
        message: 'Payment initiated successfully',
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
        message: error.message || 'Failed to initiate payment',
      });
    }
  }

  // Process refund (Super admin only)
  async processRefund(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { bookingId, amount, reason } = processRefundSchema.parse(request.body);
      const adminUserId = (request as any).user.id;

      const result = await this.paymentService.processRefund(bookingId, amount, reason, adminUserId);

      return reply.code(200).send({
        success: true,
        message: 'Refund processed successfully',
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
        message: error.message || 'Failed to process refund',
      });
    }
  }

  // Get payment history
  async getPaymentHistory(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { bookingId, userId, status, page = 1, limit = 10 } = request.query as any;
      
      // Implementation would fetch from payments table with filters
      // This is a placeholder response
      return reply.code(200).send({
        success: true,
        data: {
          payments: [],
          total: 0,
          page,
          limit,
        },
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        message: 'Failed to fetch payment history',
      });
    }
  }

  // Record offline payment
  async recordOfflinePayment(request: FastifyRequest, reply: FastifyReply) {
    try {
      const paymentData = recordOfflinePaymentSchema.parse(request.body);
      
      const processedData = {
        ...paymentData,
        transactionDate: paymentData.transactionDate ? new Date(paymentData.transactionDate) : undefined,
      };
      
      const result = await this.paymentService.recordOfflinePayment(processedData);

      return reply.code(201).send({
        success: true,
        message: 'Offline payment recorded successfully',
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
        message: error.message || 'Failed to record offline payment',
      });
    }
  }
}