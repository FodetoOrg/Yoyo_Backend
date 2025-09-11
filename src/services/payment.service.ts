// @ts-nocheck
import { FastifyInstance } from 'fastify';
import { paymentOrders, paymentWebhooks, payments, bookings, adminPayments, hotels, wallets, walletTransactions } from '../models/schema';
import { eq, and, desc, inArray, count } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { NotificationService } from './notification.service';
import { WalletService } from './wallet.service';
import { v4 as uuidv4 } from 'uuid';

interface CreatePaymentOrderParams {
  bookingId: string;
  userId: string;
  amount: number;
  currency?: string;
  useWallet?: boolean;
  walletAmount?: number;

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

  // Process wallet + online payment
  async processWalletPayment(params: {
    bookingId: string;
    userId: string;
    walletAmount: number;
    remainingAmount: number;
    razorpayPaymentDetails?: any;
  }) {
    const db = this.fastify.db;

    return await db.transaction(async (tx) => {
      try {
        // Get booking details
        const booking = await tx.query.bookings.findFirst({
          where: eq(bookings.id, params.bookingId),
          with: { user: true, hotel: true, room: true }
        });

        if (!booking) {
          throw new Error('Booking not found');
        }

        // Deduct from wallet if wallet amount > 0
        if (params.walletAmount > 0) {
          await this.walletService.debitWallet({
            userId: params.userId,
            amount: params.walletAmount,
            source: 'booking_payment',
            description: `Payment for booking ${params.bookingId}`,
            referenceId: params.bookingId,
            referenceType: 'booking',
            metadata: {
              bookingId: params.bookingId,
              hotelName: booking.hotel.name
            }
          });
        }

        // Create payment records
        const paymentId = uuidv4();
        const walletPaymentId = params.walletAmount > 0 ? uuidv4() : null;

        // Create wallet payment record if applicable
        if (params.walletAmount > 0) {
          await tx.insert(payments).values({
            id: walletPaymentId,
            bookingId: params.bookingId,
            userId: params.userId,
            amount: params.walletAmount,
            currency: 'INR',
            paymentType: params.remainingAmount > 0 ? 'partial' : 'full',
            paymentMethod: 'wallet',
            paymentMode: 'online',
            status: 'completed',
            transactionDate: new Date()
          });
        }

        // Create online payment record if applicable
        if (params.remainingAmount > 0 && params.razorpayPaymentDetails) {
          await tx.insert(payments).values({
            id: paymentId,
            bookingId: params.bookingId,
            userId: params.userId,
            amount: params.remainingAmount,
            currency: 'INR',
            paymentType: params.walletAmount > 0 ? 'partial' : 'full',
            paymentMethod: 'online',
            paymentMode: 'online',
            razorpayPaymentId: params.razorpayPaymentDetails.paymentId,
            razorpayOrderId: params.razorpayPaymentDetails.orderId,
            razorpaySignature: params.razorpayPaymentDetails.signature,
            status: 'completed',
            transactionDate: new Date()
          });
        }

        // Update booking status
        await tx.update(bookings)
          .set({
            status: 'confirmed',
            paymentStatus: 'completed',
            paymentMode: params.remainingAmount > 0 ? 'online' : 'wallet',
            updatedAt: new Date()
          })
          .where(eq(bookings.id, params.bookingId));

        // Send notifications
        await this.notificationService.sendNotificationFromTemplate('payment_success', params.userId, {
          bookingId: params.bookingId,
          totalAmount: booking.totalAmount,
          walletAmount: params.walletAmount,
          onlineAmount: params.remainingAmount,
          hotelName: booking.hotel.name
        });

        return {
          success: true,
          bookingId: params.bookingId,
          totalAmount: booking.totalAmount,
          walletAmount: params.walletAmount,
          onlineAmount: params.remainingAmount
        };

      } catch (error) {
        console.error('Wallet payment processing failed:', error);
        throw error;
      }
    });
  }


  private fastify!: FastifyInstance;
  private razorpay: Razorpay;
  private notificationService: NotificationService;
  private walletService: WalletService;

  constructor() {
    this.razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });
    this.notificationService = new NotificationService();
    this.walletService = new WalletService();
  }

  setFastify(fastify: FastifyInstance) {
    this.fastify = fastify;
    this.notificationService.setFastify(fastify);
    this.walletService.setFastify(fastify);
  }

  async sendPaymentFailureNotifications(bookingId: string, amount: number, error: string) {
    const db = this.fastify.db;

    try {
      const booking = await db.query.bookings.findFirst({
        where: eq(bookings.id, bookingId),
        with: { user: true, hotel: true }
      });

      if (!booking) return;

      setImmediate(async () => {
        try {
          // Send immediate push notification
          await this.notificationService.sendInstantBookingSuccessNotification(booking.userId, {
            title: 'Payment Failed ❌',
            message: `Payment of ₹${amount} failed for ${booking.hotel.name}. Please try again.`,
            type: 'payment_failed',
            data: {
              bookingId: bookingId,
              hotelName: booking.hotel.name,
              amount: amount,
              error: error
            }
          });

          // Send immediate email notification
          await this.notificationService.sendImmediateNotification({
            userId: booking.userId,
            type: 'email',
            title: 'Payment Failed - ' + booking.hotel.name,
            message: `
              <h2>❌ Payment Failed</h2>
              <p>Dear ${booking.user.name},</p>
              <p>Unfortunately, your payment could not be processed.</p>
              
              <div style="background: #ffe6e6; padding: 20px; margin: 20px 0; border-radius: 8px;">
                <h3>Payment Details:</h3>
                <p><strong>Amount:</strong> ₹${amount}</p>
                <p><strong>Hotel:</strong> ${booking.hotel.name}</p>
                <p><strong>Booking ID:</strong> ${bookingId}</p>
                <p><strong>Status:</strong> ❌ Failed</p>
              </div>
              
              <p>Please try again or contact our support team for assistance.</p>
              <p>Your booking is still reserved for a limited time.</p>
            `,
            source: 'payment_failed',
            sourceId: bookingId
          });

        } catch (error) {
          console.error('Failed to send payment failure notifications:', error);
        }
      });

    } catch (error) {
      console.error('Error in payment failure notifications:', error);
    }
  }

  // Send immediate notifications for online payment success
  async sendPaymentSuccessNotifications(paymentId: string, bookingId: string, amount: number) {
    const db = this.fastify.db;

    try {
      const booking = await db.query.bookings.findFirst({
        where: eq(bookings.id, bookingId),
        with: { user: true, hotel: true }
      });

      if (!booking) return;

      setImmediate(async () => {
        try {
          // Send immediate push notification
          await this.notificationService.sendInstantBookingSuccessNotification(booking.userId, {
            title: 'Payment Successful! 💳',
            message: `₹${amount} payment successful for ${booking.hotel.name}`,
            type: 'payment_success',
            data: {
              bookingId: bookingId,
              hotelName: booking.hotel.name,
              amount: amount,
              paymentId: paymentId,
              checkInDate: booking.checkInDate.toISOString(),
              checkOutDate: booking.checkOutDate.toISOString(),
              status: 'confirmed'
            }
          });

          // Send immediate email notification
          await this.notificationService.sendImmediateNotification({
            userId: booking.userId,
            type: 'email',
            title: 'Payment Successful - ' + booking.hotel.name,
            message: `
              <h2>💳 Payment Successful!</h2>
              <p>Dear ${booking.user.name},</p>
              <p>Your online payment has been processed successfully!</p>
              
              <div style="background: #e8f5e8; padding: 20px; margin: 20px 0; border-radius: 8px;">
                <h3>Payment Details:</h3>
                <p><strong>Amount:</strong> ₹${amount}</p>
                <p><strong>Hotel:</strong> ${booking.hotel.name}</p>
                <p><strong>Booking ID:</strong> ${bookingId}</p>
                <p><strong>Payment ID:</strong> ${paymentId}</p>
                <p><strong>Status:</strong> ✅ Confirmed</p>
              </div>
              
              <div style="background: #f0f8ff; padding: 20px; margin: 20px 0; border-radius: 8px;">
                <h3>Your Stay Details:</h3>
                <p><strong>Check-in:</strong> ${new Date(booking.checkInDate).toLocaleDateString()}</p>
                <p><strong>Check-out:</strong> ${new Date(booking.checkOutDate).toLocaleDateString()}</p>
              </div>
              
              <p>Thank you for your booking! We look forward to welcoming you.</p>
            `,
            source: 'payment_success',
            sourceId: paymentId
          });

        } catch (error) {
          console.error('Failed to send payment success notifications:', error);
          // Fallback to queue
          await this.notificationService.queueNotification({
            userId: booking.userId,
            type: 'push',
            priority: 1,
            title: 'Payment Successful!',
            message: `Payment successful for ${booking.hotel.name}`,
            data: {
              bookingId: bookingId,
              amount: amount,
              paymentId: paymentId
            },
            source: 'payment_success_fallback'
          });
        }
      });

    } catch (error) {
      console.error('Error in payment success notifications:', error);
    }
  }


  // Create Razorpay order with fail-safe mechanism
  async createPaymentOrder(params: CreatePaymentOrderParams) {
    const db = this.fastify.db;
    const { bookingId, userId, amount, currency = 'INR', walletAmount } = params;


    try {
      // Check if booking exists and is valid (outside transaction)
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

      if (amount !== booking.totalAmount - walletAmount) {
        throw new error('There is an issue with payment')
      }

      // // Check for existing pending order (outside transaction)
      // const existingOrder = await db.query.paymentOrders.findFirst({
      //   where: and(
      //     eq(paymentOrders.bookingId, bookingId),
      //     eq(paymentOrders.status, 'created')
      //   )
      // });

      // ('existingOrder ', existingOrder);

      // if (existingOrder && new Date() < existingOrder.expiresAt) {
      //   return {
      //     orderId: existingOrder.razorpayOrderId,
      //     amount: existingOrder.amount,
      //     currency: existingOrder.currency,
      //     receipt: existingOrder.receipt
      //   };
      // }

      // Validate wallet amount
      if (walletAmount && walletAmount < 1) {
        throw new Error('Wallet amount should be >=1 to use');
      }

      // Validate Razorpay configuration
      if (!this.razorpay) {
        throw new Error('Razorpay client not initialized');
      }

      let amountFinal = amount;
      let walletData = null;

      // Pre-validate wallet if wallet amount is provided
      if (walletAmount && walletAmount >= 1) {
        walletData = await db.query.wallets.findFirst({
          where: eq(wallets.userId, userId)
        });


        if (!walletData || walletData.balance < walletAmount) {
          throw new Error("You don't have enough wallet money to continue the payment. Try to avoid using wallet");
        }

        amountFinal = booking.totalAmount - walletAmount;


      }

      // Create Razorpay order (outside transaction since it's external API)
      const receipt = `receipt_${bookingId}_${Date.now()}`;

      const razorpayOrder = await this.razorpay.orders.create({
        amount: Math.round(amountFinal * 100), // Convert to paise
        currency,
        receipt: receipt.slice(0, 40),
        payment_capture: 1,
        notes: {
          bookingId,
          userId,
          hotelId: booking.hotelId,
        }
      });


      // Now perform all database operations in a single transaction
      const result = await db.transaction(async (tx) => {
        // 1. Process wallet deduction if applicable


        // 2. Create payment order record
        const paymentOrderId = uuidv4();
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 15); // 15 minutes expiry

        await tx.insert(paymentOrders).values({
          id: paymentOrderId,
          bookingId,
          userId,
          razorpayOrderId: razorpayOrder.id,
          amount: amountFinal, // Store the final amount after wallet deduction
          originalAmount: amount, // Store original amount for reference
          walletAmountUsed: walletAmount || 0, // Store wallet amount used
          currency,
          receipt,
          expiresAt,
        });

        // 3. Find and update existing payment record
        const existingPayment = await tx.query.payments.findFirst({
          where: and(
            eq(payments.bookingId, bookingId),
            eq(payments.status, 'pending')
          )
        });

        if (existingPayment) {
          await tx.update(payments)
            .set({
              paymentOrderId: paymentOrderId,
              paymentMode: 'online',
              paymentMethod: walletAmount >= amount ? 'wallet' : 'razorpay', // Set method based on payment type
              walletAmountUsed: walletAmount || 0,
              razorpayOrderId: razorpayOrder.id, // Link to Razorpay order
              updatedAt: new Date(),
              amount: amountFinal,
              actualPaymentAmount: amount
            })
            .where(eq(payments.id, existingPayment.id));
        } else {
          const paymentId = uuidv4();
          await tx.insert(payments).values({
            id: paymentId,
            bookingId,
            userId: userId,
            paymentOrderId: paymentOrderId,
            amount: amountFinal,
            actualPaymentAmount: amount,
            currency: 'INR',
            paymentType: 'full',
            paymentMethod: walletAmount >= amount ? 'wallet' : 'razorpay',
            paymentMode: 'online',
            razorpayOrderId: razorpayOrder.id,
            status: 'pending',
            transactionDate: new Date(),
          });
        }

        return {
          orderId: razorpayOrder.id,
          amount: amountFinal,
          originalAmount: amount,
          walletAmountUsed: walletAmount || 0,
          currency,
          receipt,
          razorpayId: process.env.RAZORPAY_KEY_ID
        };
      });

      return result;

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

      // If Razorpay order was created but DB transaction failed, 
      // you might want to handle cleanup here
      setImmediate(async () => {
        try {
          const db = this.fastify.db;
          const booking = await db.query.bookings.findFirst({
            where: eq(bookings.id, bookingId),
            with: { user: true, hotel: true }
          });

          if (booking) {
            await this.sendPaymentFailureNotifications(bookingId, amount, errorMessage);
          }
        } catch (notifError) {
          console.error('Failed to send payment failure notification:', notifError);
        }
      });

      throw new Error(`Failed to create payment order: ${errorMessage}`);
    }
  }

  // Verify payment with comprehensive validation in a single transaction
  async verifyPayment(params: VerifyPaymentParams) {
    const db = this.fastify.db;
    const { razorpayPaymentId, razorpayOrderId, razorpaySignature } = params;

    return await db.transaction(async (tx) => {
      let paymentOrder = null;

      try {
        // 1. Find and validate payment order with all required relations
        paymentOrder = await tx.query.paymentOrders.findFirst({
          where: eq(paymentOrders.razorpayOrderId, razorpayOrderId),
          with: {
            booking: {
              with: {
                user: true,
                hotel: true
              }
            }
          }
        });

        if (!paymentOrder) {
          throw new Error('Payment order not found');
        }

        if (paymentOrder.status === 'paid') {
          throw new Error('Payment already processed');
        }

        // 2. Verify Razorpay signature
        const isValidSignature = this.verifyRazorpaySignature(
          razorpayOrderId,
          razorpayPaymentId,
          razorpaySignature
        );

        if (!isValidSignature) {
          throw new Error('Invalid payment signature');
        }

        // 3. Fetch and validate payment details from Razorpay
        const razorpayPayment = await this.razorpay.payments.fetch(razorpayPaymentId);

        if (razorpayPayment.status !== 'captured') {
          throw new Error(`Payment not captured. Status: ${razorpayPayment.status}`);
        }

        // 4. Verify payment amount matches
        const expectedAmount = Math.round(paymentOrder.amount * 100); // Convert to paise
        if (razorpayPayment.amount !== expectedAmount) {
          throw new Error(`Payment amount mismatch. Expected: ${expectedAmount}, Received: ${razorpayPayment.amount}`);
        }



        // 6. Update payment record with transaction details
        const [updatedPayment] = await tx.update(payments)
          .set({
            status: 'completed',
            transactionDate: new Date(razorpayPayment.created_at * 1000),
            paymentMethod: 'online',
            razorpayPaymentId,
            razorpayOrderId,
            razorpaySignature,
            updatedAt: new Date()
          })
          .where(eq(payments.bookingId, paymentOrder.bookingId))
          .returning();

        if (!updatedPayment) {
          throw new Error('Failed to update payment record');
        }

        // 7. Update payment order status
        await tx.update(paymentOrders)
          .set({
            status: 'paid',
            updatedAt: new Date()
          })
          .where(eq(paymentOrders.id, paymentOrder.id));

        // 8. Update booking status
        await tx.update(bookings)
          .set({
            status: 'confirmed',
            paymentStatus: 'completed',
            paymentMode: 'online',
            walletAmountUsed: updatedPayment.walletAmountUsed,

            updatedAt: new Date()
          })
          .where(eq(bookings.id, paymentOrder.bookingId));

        // 9. Handle wallet debit if wallet amount was used
        if (updatedPayment.walletAmountUsed && updatedPayment.walletAmountUsed > 0) {
          // 5. Get wallet data for debit transaction
          const walletData = await tx.query.wallets.findFirst({
            where: eq(wallets.userId, paymentOrder.booking.userId)
          });

          if (!walletData) {
            throw new Error('User wallet not found,but paymnet sucessful.A');
          }
          // Check sufficient wallet balance
          if (walletData.balance < updatedPayment.walletAmountUsed) {
            throw new Error('Insufficient wallet balance for debit');
          }



          const newBalance = walletData.balance - updatedPayment.walletAmountUsed;
          const newTotalSpent = walletData.totalSpent + updatedPayment.walletAmountUsed;

          // Create wallet transaction record
          await tx.insert(walletTransactions).values({
            id: uuidv4(),
            walletId: walletData.id,
            userId: walletData.userId,
            type: 'debit',
            source: 'payment',
            amount: updatedPayment.walletAmountUsed,
            balanceAfter: newBalance,
            description: `Payment for booking ${paymentOrder.bookingId}`,
            referenceId: paymentOrder.bookingId,
            referenceType: 'payment',
            createdAt: new Date()
          });

          // Update wallet balance
          await tx.update(wallets)
            .set({
              balance: newBalance,
              totalSpent: newTotalSpent,
              updatedAt: new Date()
            })
            .where(eq(wallets.id, walletData.id));
        }

        // 10. Prepare notification data
        const notificationData = {
          bookingId: paymentOrder.bookingId,
          paymentId: razorpayPaymentId,
          amount: razorpayPayment.amount / 100,
          hotelName: paymentOrder.booking.hotel.name,
          guestName: paymentOrder.booking.user.name,
          checkIn: paymentOrder.booking.checkInDate
        };

        // Transaction successful - now send notifications (outside transaction)
        // These are queued to run after transaction commits
        setImmediate(async () => {
          try {
            // Send success notification to user
            await this.notificationService.sendNotificationFromTemplate(
              'payment_success',
              paymentOrder.booking.userId,
              notificationData
            );

            // Send new booking notification to hotel owner
            if (paymentOrder.booking.hotel.ownerId) {
              await this.notificationService.sendNotificationFromTemplate(
                'new_booking_hotel',
                paymentOrder.booking.hotel.ownerId,
                notificationData
              );
            }
          } catch (notificationError) {
            console.error('Failed to send notifications:', notificationError);
            // Note: We don't throw here as payment is already processed
          }
        });

        return {
          success: true,
          paymentId: updatedPayment.id,
          bookingId: paymentOrder.bookingId,
          amount: razorpayPayment.amount / 100,
          walletAmountUsed: updatedPayment.walletAmountUsed || 0
        };

      } catch (error) {
        console.error('Payment verification failed:', error);

        // Handle failure updates within the same transaction
        if (paymentOrder) {
          try {
            // Update payment order status to failed
            await tx.update(paymentOrders)
              .set({
                status: 'failed',
                attempts: (paymentOrder.attempts || 0) + 1,
                updatedAt: new Date(),
                failureReason: error.message
              })
              .where(eq(paymentOrders.id, paymentOrder.id));

            // Update booking status to failed
            await tx.update(bookings)
              .set({
                status: 'payment_failed',
                paymentStatus: 'failed',
                updatedAt: new Date()
              })
              .where(eq(bookings.id, paymentOrder.bookingId));

            // Queue failure notification (outside transaction)
            setImmediate(async () => {
              try {
                await this.notificationService.sendNotificationFromTemplate(
                  'payment_failed',
                  paymentOrder.booking.userId,
                  {
                    bookingId: paymentOrder.bookingId,
                    error: error.message,
                    hotelName: paymentOrder.booking.hotel.name
                  }
                );
              } catch (notificationError) {
                console.error('Failed to send failure notification:', notificationError);
              }
            });

          } catch (updateError) {
            console.error('Failed to update failure status:', updateError);
          }
        }

        // Re-throw the original error
        throw new Error(`Payment verification failed: ${error.message}`);
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

        setImmediate(async () => {
          try {
            // Send immediate push notification for payment received
            await this.notificationService.sendInstantBookingSuccessNotification(booking.userId, {
              title: 'Payment Received! 💰',
              message: `₹${data.amount} payment received for ${booking.hotel.name}`,
              type: 'payment_received',
              data: {
                bookingId: booking.id,
                hotelName: booking.hotel.name,
                amount: data.amount,
                paymentType,
                receiptNumber,
                isFullPayment: isFullyPaid,
                remainingAmount: newRemainingAmount
              }
            });

            // Send immediate email notification
            await this.notificationService.sendImmediateNotification({
              userId: booking.userId,
              type: 'email',
              title: 'Payment Confirmation - ' + booking.hotel.name,
              message: `
                  <h2>💰 Payment Received!</h2>
                  <p>Dear ${booking.user.name},</p>
                  <p>We have received your payment for booking at <strong>${booking.hotel.name}</strong>.</p>
                  
                  <div style="background: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 8px;">
                    <h3>Payment Details:</h3>
                    <p><strong>Amount Paid:</strong> ₹${data.amount}</p>
                    <p><strong>Payment Method:</strong> ${data.paymentMethod}</p>
                    <p><strong>Receipt Number:</strong> ${receiptNumber}</p>
                    <p><strong>Payment Type:</strong> ${paymentType}</p>
                    ${isFullyPaid ? '<p><strong>Status:</strong> ✅ Fully Paid</p>' : `<p><strong>Remaining Amount:</strong> ₹${newRemainingAmount}</p>`}
                  </div>
                  
                  <p>Thank you for your payment!</p>
                `,
              source: 'payment_received',
              sourceId: paymentId
            });

            // If fully paid, send booking confirmation notification
            if (isFullyPaid) {
              await this.notificationService.sendInstantBookingSuccessNotification(booking.userId, {
                title: 'Booking Fully Paid & Confirmed! ✅',
                message: `Your booking at ${booking.hotel.name} is now fully paid and confirmed`,
                type: 'booking_confirmed',
                data: {
                  bookingId: booking.id,
                  hotelName: booking.hotel.name,
                  checkInDate: booking.checkInDate.toISOString(),
                  checkOutDate: booking.checkOutDate.toISOString(),
                  totalAmount: booking.totalAmount,
                  status: 'confirmed'
                }
              });

              await this.notificationService.sendImmediateNotification({
                userId: booking.userId,
                type: 'email',
                title: 'Booking Confirmed - ' + booking.hotel.name,
                message: `
                    <h2>✅ Booking Confirmed!</h2>
                    <p>Congratulations! Your booking is now fully paid and confirmed.</p>
                    
                    <div style="background: #e8f5e8; padding: 20px; margin: 20px 0; border-radius: 8px;">
                      <h3>Booking Details:</h3>
                      <p><strong>Hotel:</strong> ${booking.hotel.name}</p>
                      <p><strong>Check-in:</strong> ${new Date(booking.checkInDate).toLocaleDateString()}</p>
                      <p><strong>Check-out:</strong> ${new Date(booking.checkOutDate).toLocaleDateString()}</p>
                      <p><strong>Total Amount:</strong> ₹${booking.totalAmount}</p>
                      <p><strong>Status:</strong> Confirmed ✅</p>
                    </div>
                    
                    <p>We're excited to welcome you!</p>
                  `,
                source: 'booking_confirmed',
                sourceId: booking.id
              });
            }

          } catch (error) {
            console.error('Failed to send immediate payment notifications:', error);
            // Fallback to templates
            await this.notificationService.sendNotificationFromTemplate('offline_payment_received', booking.userId, {
              amount: data.amount,
              paymentType,
              receiptNumber,
              hotelName: booking.hotel.name,
              bookingId: booking.id
            });

            if (isFullyPaid) {
              await this.notificationService.sendNotificationFromTemplate('booking_confirmed_offline', booking.userId, {
                hotelName: booking.hotel.name,
                checkIn: booking.checkInDate.toISOString(),
                checkOut: booking.checkOutDate.toISOString(),
                totalAmount: booking.totalAmount,
                bookingId: booking.id
              });
            }
          }
        });

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


    // For hotel filtering, we need to join with bookings table
    let query = db
      .select()
      .from(payments)
      .leftJoin(bookings, eq(payments.bookingId, bookings.id));

    // Add hotel filter if provided
    if (hotelId) {
      query = query.where(and(
        whereConditions.length > 0 ? and(...whereConditions) : undefined,
        eq(bookings.hotelId, hotelId)
      ));
    } else if (whereConditions.length > 0) {
      query = query.where(and(...whereConditions));
    }

    // Apply pagination and ordering
    const rawPayments = await query
      .orderBy(desc(payments.createdAt))
      .limit(limit)
      .offset((page - 1) * limit);

    // Now get the full payment data with relations for the filtered results
    const paymentIds = rawPayments.map(row => row.payments.id);

    const paymentHistory = await db.query.payments.findMany({
      where: inArray(payments.id, paymentIds),
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
              }
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
    });

    // Get total count with the same filtering logic
    let countQuery = db
      .select({ count: count() })
      .from(payments)
      .leftJoin(bookings, eq(payments.bookingId, bookings.id));

    if (hotelId) {
      countQuery = countQuery.where(and(
        whereConditions.length > 0 ? and(...whereConditions) : undefined,
        eq(bookings.hotelId, hotelId)
      ));
    } else if (whereConditions.length > 0) {
      countQuery = countQuery.where(and(...whereConditions));
    }

    const totalResult = await countQuery;
    const totalPayments = totalResult[0]?.count || 0;


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
        hotelId: payment.booking.hotel?.id || null,
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
      total: totalPayments,
      page,
      limit,
      totalPages: Math.ceil(totalPayments / limit),
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
  }

  private async handlePaymentFailed(event: any) {
    // Handle failed payments
  }

  private async handleOrderPaid(event: any) {
    // Handle order paid events
  }
}