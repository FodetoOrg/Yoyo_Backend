import { FastifyInstance } from 'fastify';
import { paymentOrders, paymentWebhooks, payments, bookings, adminPayments } from '../models/schema';
import { eq, and, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { NotificationService } from './notification.service';

interface CreatePaymentOrderParams {
  bookingId: string;
  userId: string;
  amount: number;
  currency?: string;
}

interface VerifyPaymentParams {
  razorpayPaymentId: string;
  razorpayOrderId: string;
  razorpaySignature: string;
}

interface AdminPaymentParams {
  type: 'hotel_payment' | 'user_refund';
  fromUserId: string;
  toUserId: string;
  amount: number;
  method: string;
  reason?: string;
  hotelId?: string;
  bookingId?: string;
  revenueRecordId?: string;
  metadata?: any;
}

export class PaymentService {
  private fastify!: FastifyInstance;
  private razorpay: Razorpay;
  private notificationService: NotificationService;

  constructor() {
    this.razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID || '',
      key_secret: process.env.RAZORPAY_KEY_SECRET || ''
    });
    this.notificationService = new NotificationService();
  }

  setFastify(fastify: FastifyInstance) {
    this.fastify = fastify;
    this.notificationService.setFastify(fastify);
  }

  // Create Razorpay order with fail-safe mechanism
  async createPaymentOrder(params: CreatePaymentOrderParams) {
    const db = this.fastify.db;
    const { bookingId, userId, amount, currency = 'INR' } = params;

    try {
      // Check if booking exists and is valid
      const booking = await db.query.bookings.findFirst({
        where: eq(bookings.id, bookingId),
        with: { user: true, hotel: true, room: true }
      });

      if (!booking) {
        throw new Error('Booking not found');
      }

      if (booking.paymentStatus === 'completed') {
        throw new Error('Payment already completed for this booking');
      }

      // Check for existing pending order
      const existingOrder = await db.query.paymentOrders.findFirst({
        where: and(
          eq(paymentOrders.bookingId, bookingId),
          eq(paymentOrders.status, 'created')
        )
      });

      if (existingOrder && new Date() < existingOrder.expiresAt) {
        return {
          orderId: existingOrder.razorpayOrderId,
          amount: existingOrder.amount,
          currency: existingOrder.currency,
          receipt: existingOrder.receipt
        };
      }

      // Create Razorpay order
      const receipt = `receipt_${bookingId}_${Date.now()}`;
      const razorpayOrder = await this.razorpay.orders.create({
        amount: Math.round(amount * 100), // Convert to paise
        currency,
        receipt,
        payment_capture: 1,
        notes: {
          bookingId,
          userId,
          hotelId: booking.hotelId
        }
      });

      // Store order in database
      const paymentOrderId = uuidv4();
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 15); // 15 minutes expiry

      await db.insert(paymentOrders).values({
        id: paymentOrderId,
        bookingId,
        userId,
        razorpayOrderId: razorpayOrder.id,
        amount,
        currency,
        receipt,
        expiresAt,
      });

      // Send order created notification
      await this.notificationService.sendNotificationFromTemplate('payment_order_created', userId, {
        bookingId,
        orderId: razorpayOrder.id,
        amount,
        hotelName: booking.hotel.name,
        expiresAt: expiresAt.toISOString()
      });

      return {
        orderId: razorpayOrder.id,
        amount,
        currency,
        receipt
      };

    } catch (error) {
      console.error('Error creating payment order:', error);
      
      // Send error notification
      await this.notificationService.sendNotificationFromTemplate('payment_order_failed', userId, {
        bookingId,
        error: error.message
      });

      throw new Error(`Failed to create payment order: ${error.message}`);
    }
  }

  // Verify payment with comprehensive validation
  async verifyPayment(params: VerifyPaymentParams) {
    const db = this.fastify.db;
    const { razorpayPaymentId, razorpayOrderId, razorpaySignature } = params;

    return await db.transaction(async (tx) => {
      try {
        // Find payment order
        const paymentOrder = await tx.query.paymentOrders.findFirst({
          where: eq(paymentOrders.razorpayOrderId, razorpayOrderId),
          with: { booking: { with: { user: true, hotel: true } } }
        });

        if (!paymentOrder) {
          throw new Error('Payment order not found');
        }

        // Verify signature
        const isValidSignature = this.verifyRazorpaySignature(
          razorpayOrderId,
          razorpayPaymentId,
          razorpaySignature
        );

        if (!isValidSignature) {
          throw new Error('Invalid payment signature');
        }

        // Fetch payment details from Razorpay
        const razorpayPayment = await this.razorpay.payments.fetch(razorpayPaymentId);

        if (razorpayPayment.status !== 'captured') {
          throw new Error('Payment not captured');
        }

        // Update payment order status
        await tx.update(paymentOrders)
          .set({ 
            status: 'paid',
            updatedAt: new Date()
          })
          .where(eq(paymentOrders.id, paymentOrder.id));

        // Create payment record
        const paymentId = uuidv4();
        await tx.insert(payments).values({
          id: paymentId,
          bookingId: paymentOrder.bookingId,
          userId: paymentOrder.userId,
          amount: razorpayPayment.amount / 100, // Convert from paise
          currency: razorpayPayment.currency,
          paymentMethod: razorpayPayment.method,
          razorpayPaymentId,
          razorpayOrderId,
          razorpaySignature,
          status: 'completed',
          transactionDate: new Date(razorpayPayment.created_at * 1000),
        });

        // Update booking status
        await tx.update(bookings)
          .set({
            status: 'confirmed',
            paymentStatus: 'completed',
            updatedAt: new Date()
          })
          .where(eq(bookings.id, paymentOrder.bookingId));

        // Send success notifications
        await this.notificationService.sendNotificationFromTemplate('payment_success', paymentOrder.userId, {
          bookingId: paymentOrder.bookingId,
          paymentId: razorpayPaymentId,
          amount: razorpayPayment.amount / 100,
          hotelName: paymentOrder.booking.hotel.name
        });

        // Send hotel notification
        if (paymentOrder.booking.hotel.ownerId) {
          await this.notificationService.sendNotificationFromTemplate('new_booking_hotel', paymentOrder.booking.hotel.ownerId, {
            bookingId: paymentOrder.bookingId,
            guestName: paymentOrder.booking.user.name,
            amount: razorpayPayment.amount / 100,
            checkIn: paymentOrder.booking.checkInDate
          });
        }

        return {
          success: true,
          paymentId,
          bookingId: paymentOrder.bookingId,
          amount: razorpayPayment.amount / 100
        };

      } catch (error) {
        console.error('Payment verification failed:', error);
        
        // Update order status to failed
        if (paymentOrder) {
          await tx.update(paymentOrders)
            .set({ 
              status: 'failed',
              attempts: paymentOrder.attempts + 1,
              updatedAt: new Date()
            })
            .where(eq(paymentOrders.id, paymentOrder.id));

          // Send failure notification
          await this.notificationService.sendNotificationFromTemplate('payment_failed', paymentOrder.userId, {
            bookingId: paymentOrder.bookingId,
            error: error.message
          });
        }

        throw error;
      }
    });
  }

  // Handle Razorpay webhooks
  async handleWebhook(signature: string, payload: string) {
    const db = this.fastify.db;

    try {
      // Verify webhook signature
      const isValidSignature = this.verifyWebhookSignature(signature, payload);
      if (!isValidSignature) {
        throw new Error('Invalid webhook signature');
      }

      const event = JSON.parse(payload);
      const webhookId = uuidv4();

      // Store webhook for processing
      await db.insert(paymentWebhooks).values({
        id: webhookId,
        razorpayEventId: event.event_id || uuidv4(),
        event: event.event,
        paymentId: event.payload?.payment?.entity?.id,
        orderId: event.payload?.payment?.entity?.order_id,
        signature,
        payload,
      });

      // Process webhook asynchronously
      setImmediate(() => this.processWebhook(webhookId));

      return { success: true };

    } catch (error) {
      console.error('Webhook handling failed:', error);
      throw error;
    }
  }

  // Process webhook events
  private async processWebhook(webhookId: string) {
    const db = this.fastify.db;

    try {
      const webhook = await db.query.paymentWebhooks.findFirst({
        where: eq(paymentWebhooks.id, webhookId)
      });

      if (!webhook || webhook.processed) {
        return;
      }

      const event = JSON.parse(webhook.payload);

      switch (webhook.event) {
        case 'payment.captured':
          await this.handlePaymentCaptured(event);
          break;
        case 'payment.failed':
          await this.handlePaymentFailed(event);
          break;
        case 'order.paid':
          await this.handleOrderPaid(event);
          break;
        default:
          console.log(`Unhandled webhook event: ${webhook.event}`);
      }

      // Mark as processed
      await db.update(paymentWebhooks)
        .set({ 
          processed: true,
          processedAt: new Date()
        })
        .where(eq(paymentWebhooks.id, webhookId));

    } catch (error) {
      console.error(`Webhook processing failed for ${webhookId}:`, error);
      
      // Update retry count
      await db.update(paymentWebhooks)
        .set({ 
          retryCount: webhook.retryCount + 1,
          error: error.message
        })
        .where(eq(paymentWebhooks.id, webhookId));
    }
  }

  // Admin payment to hotels
  async createHotelPayment(params: AdminPaymentParams) {
    const db = this.fastify.db;
    const paymentId = uuidv4();

    try {
      await db.insert(adminPayments).values({
        id: paymentId,
        type: params.type,
        fromUserId: params.fromUserId,
        toUserId: params.toUserId,
        amount: params.amount,
        method: params.method,
        reason: params.reason,
        hotelId: params.hotelId,
        bookingId: params.bookingId,
        revenueRecordId: params.revenueRecordId,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      });

      // Send notifications
      await this.notificationService.sendNotificationFromTemplate('admin_payment_initiated', params.toUserId, {
        paymentId,
        amount: params.amount,
        type: params.type,
        reason: params.reason
      });

      return { paymentId, status: 'pending' };

    } catch (error) {
      console.error('Admin payment creation failed:', error);
      throw error;
    }
  }

  // Process refund
  async processRefund(bookingId: string, amount: number, reason: string, adminUserId: string) {
    const db = this.fastify.db;

    try {
      // Find original payment
      const payment = await db.query.payments.findFirst({
        where: eq(payments.bookingId, bookingId),
        with: { booking: { with: { user: true } } }
      });

      if (!payment) {
        throw new Error('Original payment not found');
      }

      // Create refund with Razorpay
      const refund = await this.razorpay.payments.refund(payment.razorpayPaymentId, {
        amount: Math.round(amount * 100), // Convert to paise
        notes: {
          reason,
          adminUserId,
          bookingId
        }
      });

      // Create admin payment record
      const refundPayment = await this.createHotelPayment({
        type: 'user_refund',
        fromUserId: adminUserId,
        toUserId: payment.userId,
        amount,
        method: 'razorpay_refund',
        reason,
        bookingId,
        metadata: { razorpayRefundId: refund.id }
      });

      // Send notifications
      await this.notificationService.sendNotificationFromTemplate('refund_processed', payment.userId, {
        bookingId,
        amount,
        reason,
        refundId: refund.id
      });

      return refundPayment;

    } catch (error) {
      console.error('Refund processing failed:', error);
      throw error;
    }
  }

  // Helper methods
  private verifyRazorpaySignature(orderId: string, paymentId: string, signature: string): boolean {
    const body = orderId + '|' + paymentId;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
      .update(body.toString())
      .digest('hex');
    
    return expectedSignature === signature;
  }

  private verifyWebhookSignature(signature: string, payload: string): boolean {
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET || '')
      .update(payload)
      .digest('hex');
    
    return expectedSignature === signature;
  }

  private async handlePaymentCaptured(event: any) {
    // Additional processing for captured payments
    console.log('Payment captured:', event.payload.payment.entity.id);
  }

  private async handlePaymentFailed(event: any) {
    // Handle failed payments
    console.log('Payment failed:', event.payload.payment.entity.id);
  }

  private async handleOrderPaid(event: any) {
    // Handle order paid events
    console.log('Order paid:', event.payload.order.entity.id);
  }
}