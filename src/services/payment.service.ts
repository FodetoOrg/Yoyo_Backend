// @ts-nocheck
import { FastifyInstance } from 'fastify';
import { paymentOrders, paymentWebhooks, payments, bookings, adminPayments, hotels } from '../models/schema';
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

interface PaymentHistoryFilters {
  userId?: string;
  bookingId?: string;
  status?: string;
  paymentMode?: string;
  page?: number;
  limit?: number;
  hotelId?: string;
}

export class PaymentService {
  private fastify!: FastifyInstance;
  private razorpay: Razorpay;
  private notificationService: NotificationService;

  constructor() {
    this.razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
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

      console.log('booking ', booking);

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
      console.log('existingOrder ', existingOrder);

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
      console.log('receipt ', receipt);

      // Validate Razorpay configuration before making API call
      if (!this.razorpay) {
        throw new Error('Razorpay client not initialized');
      }

      console.log('Creating Razorpay order with amount:', Math.round(amount * 100));

      const razorpayOrder = await this.razorpay.orders.create({
        amount: Math.round(amount * 100), // Convert to paise
        currency,
        receipt: receipt.slice(0, 40),
        payment_capture: 1,
        notes: {
          bookingId,
          userId,
          hotelId: booking.hotelId
        }
      });

      console.log('Razorpay order created successfully:', razorpayOrder.id);

      // Find existing payment record
      const existingPayment = await db.query.payments.findFirst({
        where: and(
          eq(payments.bookingId, bookingId),
          eq(payments.status, 'pending')
        )
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

      // Link payment order to existing payment
      if (existingPayment) {
        await db.update(payments)
          .set({
            paymentOrderId: paymentOrderId,
            paymentMode: 'online',
            paymentMethod: 'razorpay',
            updatedAt: new Date()
          })
          .where(eq(payments.id, existingPayment.id));
      }

      return {
        orderId: razorpayOrder.id,
        amount,
        currency,
        receipt
      };

    } catch (error) {
      console.error('Error creating payment order:', error);

      // Better error message extraction
      let errorMessage = 'Unknown error occurred';

      if (error.error?.description) {
        // Razorpay specific error
        errorMessage = error.error.description;
        console.error('Razorpay error details:', {
          code: error.error.code,
          description: error.error.description,
          statusCode: error.statusCode
        });
      } else if (error.message) {
        // Standard error
        errorMessage = error.message;
      }

      // Send error notification
      // await this.notificationService.sendNotificationFromTemplate('payment_order_failed', userId, {
      //   bookingId,
      //   error: errorMessage
      // });

      throw new Error(`Failed to create payment order: ${errorMessage}`);
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

          console.log('came here ')

        const paymentReturned = await tx.update(payments).set({
          status: 'completed',
          transactionDate: new Date(razorpayPayment.created_at * 1000),
          paymentMethod:'online',
          razorpayPaymentId,
          razorpayOrderId,
          razorpaySignature,
        }).where(eq(payments.bookingId, paymentOrder.bookingId)).returning();

       
        console.log('came here 2')
       
        // Update booking status
        await tx.update(bookings)
          .set({
            status: 'confirmed',
            paymentStatus: 'completed',
            updatedAt: new Date(),
            paymentMode:'online'
          })
          .where(eq(bookings.id, paymentOrder.bookingId));

          console.log(' udpated bookings ',paymentOrder.bookingId)

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
          paymentId:paymentReturned[0].id,
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

  // Record offline payment
  async recordOfflinePayment(data: {
    bookingId: string;
    amount: number;
    paymentMethod: string;
    receivedBy: string;
    recordedBy: string;
    receiptNumber?: string;
    transactionDate?: Date;
    notes?: string;
  }) {
    const db = this.fastify.db;

    return await db.transaction(async (tx) => {
      try {
        // Get booking details
        const booking = await tx.query.bookings.findFirst({
          where: eq(bookings.id, data.bookingId),
          with: {
            user: true,
            hotel: true,
            room: true
          }
        });

        if (!booking) {
          throw new Error('Booking not found');
        }

        // Validate payment mode
        if (booking.paymentMode !== 'offline' && booking.paymentMode !== 'both') {
          throw new Error('This booking does not support offline payments');
        }

        // Check if amount is valid
        if (data.amount <= 0 || data.amount > booking.remainingAmount) {
          throw new Error(`Invalid amount. Maximum allowed: ₹${booking.remainingAmount}`);
        }

        // Generate receipt number if not provided
        const receiptNumber = data.receiptNumber ||
          `RCP-${booking.id.substring(0, 6)}-${Date.now().toString().substring(7)}`;

        // Create payment record
        const paymentId = uuidv4();
        const transactionDate = data.transactionDate || new Date();

        // Determine payment type
        let paymentType = 'partial';
        if (data.amount === booking.totalAmount) {
          paymentType = 'full';
        } else if (data.amount === booking.remainingAmount) {
          paymentType = 'remaining';
        } else if (booking.advanceAmount === 0) {
          paymentType = 'advance';
        }

        // Create payment record
        await tx.insert(payments).values({
          id: paymentId,
          bookingId: data.bookingId,
          userId: booking.userId,
          amount: data.amount,
          currency: 'INR',
          paymentType,
          paymentMethod: data.paymentMethod,
          paymentMode: 'offline',
          offlinePaymentDetails: JSON.stringify({
            receivedBy: data.receivedBy,
            recordedBy: data.recordedBy,
            notes: data.notes,
            location: booking.hotel.name
          }),
          receivedBy: data.receivedBy,
          receiptNumber,
          status: 'completed',
          transactionDate,
        });

        // Update booking
        const newRemainingAmount = booking.remainingAmount - data.amount;
        const newAdvanceAmount = booking.advanceAmount + data.amount;
        const isFullyPaid = newRemainingAmount === 0;

        await tx.update(bookings)
          .set({
            remainingAmount: newRemainingAmount,
            advanceAmount: newAdvanceAmount,
            paymentStatus: isFullyPaid ? 'completed' : 'partial',
            status: isFullyPaid ? 'confirmed' : booking.status,
            updatedAt: new Date()
          })
          .where(eq(bookings.id, data.bookingId));

        // Send notifications
        await this.notificationService.sendNotificationFromTemplate('offline_payment_received', booking.userId, {
          amount: data.amount,
          paymentType,
          receiptNumber,
          hotelName: booking.hotel.name,
          bookingId: booking.id
        });

        // If fully paid, send booking confirmation
        if (isFullyPaid) {
          await this.notificationService.sendNotificationFromTemplate('booking_confirmed_offline', booking.userId, {
            hotelName: booking.hotel.name,
            checkIn: booking.checkInDate.toISOString(),
            checkOut: booking.checkOutDate.toISOString(),
            totalAmount: booking.totalAmount,
            bookingId: booking.id
          });
        }

        // Notify hotel owner if exists
        if (booking.hotel.ownerId) {
          await this.notificationService.sendNotificationFromTemplate('new_booking_hotel', booking.hotel.ownerId, {
            bookingId: booking.id,
            guestName: booking.user.name || 'Guest',
            amount: data.amount,
            checkIn: booking.checkInDate.toISOString()
          });
        }

        return {
          paymentId,
          bookingId: booking.id,
          amount: data.amount,
          receiptNumber,
          paymentMethod: data.paymentMethod,
          status: 'completed',
          isFullPayment: isFullyPaid,
          remainingAmount: newRemainingAmount,
          transactionDate
        };

      } catch (error) {
        console.error('Offline payment recording failed:', error);
        throw error;
      }
    });
  }

  // Get payment history
  async getPaymentHistory(filters: PaymentHistoryFilters) {
    const db = this.fastify.db;
    const { userId, bookingId, status, paymentMode, page = 1, limit = 10, hotelId } = filters;

    console.log('userid ', userId)
    console.log(bookingId)
    console.log(paymentMode)
    console.log('sttaus ', status)
    console.log(hotelId)

    let whereConditions: any[] = [];

    if (userId) {
      whereConditions.push(eq(payments.userId, userId));
    }

    if (bookingId) {
      whereConditions.push(eq(payments.bookingId, bookingId));
    }

    if (status) {
      whereConditions.push(eq(payments.status, status));
    }

    if (paymentMode) {
      whereConditions.push(eq(payments.paymentMode, paymentMode));
    }
    // if(hotelId){
    //   whereConditions.push(eq(hotels.id, hotelId));
    // }

    const paymentHistory = await db.query.payments.findMany({
      where: whereConditions.length > 0 ? and(...whereConditions) : undefined,
      with: {
        user: {
          columns: {
            id: true,
            name: true,
            phone: true
          }
        },
        booking: {
          with: {
            hotel: {
              columns: {
                id: true,
                name: true,
              },
              where: hotelId ? eq(hotels.id, hotelId) : eq(1, 1)
            },
            room: {
              columns: {
                id: true,
                name: true,
                roomNumber: true,
              }
            }
          }
        }
      },
      orderBy: [desc(payments.createdAt)],
      limit,
      offset: (page - 1) * limit,
    });

    // Get total count
    const totalPayments = await db.query.payments.findMany({
      where: whereConditions.length > 0 ? and(...whereConditions) : undefined,
    });

    return {
      payments: paymentHistory.map(payment => ({
        id: payment.id,
        user: {
          id: payment.user.id,
          name: payment.user.name,
          phone: payment.user.phone
        },

        bookingId: payment.bookingId,
        amount: payment.amount,
        currency: payment.currency,
        paymentType: payment.paymentType,
        paymentMethod: payment.paymentMethod,
        paymentMode: payment.paymentMode,
        status: payment.status,
        receiptNumber: payment.receiptNumber,
        transactionDate: payment.transactionDate,
        createdAt: payment.createdAt,
        razorpayOrderId: payment.razorpayOrderId || null,
        razorpayPaymentId: payment.razorpayPaymentId || null,
        razorpaySignature: payment.razorpaySignature || null,
        hotelId: payment.booking.hotel.id,
        booking: {
          id: payment.booking.id,
          checkInDate: payment.booking.checkInDate,
          checkOutDate: payment.booking.checkOutDate,
          totalAmount: payment.booking.totalAmount,
          hotel: payment.booking.hotel,
          room: payment.booking.room,
        },
        offlinePaymentDetails: payment.offlinePaymentDetails ? JSON.parse(payment.offlinePaymentDetails) : null,
      })),
      total: totalPayments.length,
      page,
      limit,
      totalPages: Math.ceil(totalPayments.length / limit),
    };
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
          retryCount: webhookId.retryCount + 1,
          error: error.message
        })
        .where(eq(paymentWebhooks.id, webhookId));
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