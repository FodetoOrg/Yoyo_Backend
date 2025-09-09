// @ts-nocheck
import { FastifyInstance } from 'fastify';
import { eq, and, desc } from 'drizzle-orm';
import { refunds, bookings, wallets, walletTransactions } from '../models/schema';
import { v4 as uuidv4 } from 'uuid';
import { NotificationService } from './notification.service';
import { WalletService } from './wallet.service'; // Assuming WalletService is in './wallet.service'
import { UserRole } from '../types/common';
import { P } from 'pino';

export class RefundService {
  private fastify: FastifyInstance;
  private notificationService: NotificationService;
  private walletService: WalletService;

  constructor(fastify: FastifyInstance) {
    this.fastify = fastify;
    this.notificationService = new NotificationService();
    this.walletService = new WalletService();
    this.notificationService= new NotificationService()
  }

  setFastify(fastify: FastifyInstance) {
    this.fastify = fastify;
    this.notificationService.setFastify(fastify);
    this.walletService.setFastify(fastify); // Set fastify instance for walletService
  }

  async sendRefundStatusNotifications(refundId: string, status: string, userId: string, bookingId: string, amount: number, hotelName: string) {
    setImmediate(async () => {
      try {
        let title = '';
        let message = '';
        let emailTitle = '';
        let emailContent = '';

        switch (status) {
          case 'approved':
            title = 'Refund Approved! 💰';
            message = `Your refund of ₹${amount} for ${hotelName} has been approved`;
            emailTitle = 'Refund Approved - ' + hotelName;
            emailContent = `
              <h2>💰 Refund Approved!</h2>
              <p>Great news! Your refund has been approved.</p>
              <div style="background: #e8f5e8; padding: 20px; margin: 20px 0; border-radius: 8px;">
                <h3>Refund Details:</h3>
                <p><strong>Amount:</strong> ₹${amount}</p>
                <p><strong>Hotel:</strong> ${hotelName}</p>
                <p><strong>Booking ID:</strong> ${bookingId}</p>
                <p><strong>Status:</strong> Approved ✅</p>
              </div>
              <p>The refund will be processed to your original payment method within 5-7 business days.</p>
            `;
            break;
          case 'processed':
            title = 'Refund Processed! 💳';
            message = `Your refund of ₹${amount} for ${hotelName} has been processed`;
            emailTitle = 'Refund Processed - ' + hotelName;
            emailContent = `
              <h2>💳 Refund Processed!</h2>
              <p>Your refund has been successfully processed.</p>
              <div style="background: #e8f5e8; padding: 20px; margin: 20px 0; border-radius: 8px;">
                <h3>Refund Details:</h3>
                <p><strong>Amount:</strong> ₹${amount}</p>
                <p><strong>Hotel:</strong> ${hotelName}</p>
                <p><strong>Booking ID:</strong> ${bookingId}</p>
                <p><strong>Status:</strong> Processed ✅</p>
              </div>
              <p>You should see the refund in your account within 5-7 business days.</p>
            `;
            break;
          case 'rejected':
            title = 'Refund Request Rejected ❌';
            message = `Your refund request for ${hotelName} has been rejected`;
            emailTitle = 'Refund Request Rejected - ' + hotelName;
            emailContent = `
              <h2>❌ Refund Request Rejected</h2>
              <p>Unfortunately, your refund request has been rejected.</p>
              <div style="background: #ffe6e6; padding: 20px; margin: 20px 0; border-radius: 8px;">
                <h3>Request Details:</h3>
                <p><strong>Hotel:</strong> ${hotelName}</p>
                <p><strong>Booking ID:</strong> ${bookingId}</p>
                <p><strong>Status:</strong> Rejected ❌</p>
              </div>
              <p>If you believe this is an error, please contact our support team.</p>
            `;
            break;
        }

        // Send immediate push notification
        await this.notificationService.sendInstantBookingSuccessNotification(userId, {
          title,
          message,
          type: 'refund_status_update',
          data: {
            refundId,
            bookingId,
            status,
            amount,
            hotelName
          }
        });

        // Send immediate email notification
        await this.notificationService.sendImmediateNotification({
          userId,
          type: 'email',
          title: emailTitle,
          message: emailContent,
          source: 'refund_status_update',
          sourceId: refundId
        });

      } catch (error) {
        console.error('Failed to send refund status notifications:', error);
        // Fallback to queue
        await this.notificationService.queueNotification({
          userId,
          type: 'push',
          priority: 1,
          title: 'Refund Status Update',
          message: `Your refund status has been updated`,
          data: {
            refundId,
            bookingId,
            status
          },
          source: 'refund_status_fallback'
        });
      }
    });
  }

  // Calculate cancellation fee and refund amount
  private calculateRefundAmount(
    totalAmount: number,
    cancellationFeePercentage: number,
    checkInDate: Date,
    cancellationTimeHours: number
  ) {
    const now = new Date();
    const timeUntilCheckIn = checkInDate.getTime() - now.getTime();
    const hoursUntilCheckIn = timeUntilCheckIn / (1000 * 60 * 60);

    let cancellationFeeAmount = 0;
    let refundAmount = totalAmount;

    // Apply cancellation fee if cancelled within the cancellation time window
    if (hoursUntilCheckIn < cancellationTimeHours) {
      cancellationFeeAmount = (totalAmount * cancellationFeePercentage) / 100;
      refundAmount = totalAmount - cancellationFeeAmount;
    }

    return {
      cancellationFeeAmount: Math.round(cancellationFeeAmount * 100) / 100,
      refundAmount: Math.round(refundAmount * 100) / 100,
      hoursUntilCheckIn: Math.round(hoursUntilCheckIn * 100) / 100
    };
  }

  async createRefundRequest(params: {
    bookingId: string;
    user: any; // Changed from userId to user object
    refundReason: string;
    refundType: 'cancellation' | 'hotel_cancellation' | 'no_show' | 'admin_refund';
  }) {
    const db = this.fastify.db;
    // Removed log('came in refund');

    return await db.transaction(async (tx) => {
      // Get booking with hotel and payment details
      const booking = await tx.query.bookings.findFirst({
        where: eq(bookings.id, params.bookingId),
        with: {
          hotel: true,
          payment: true,
          user: true
        }
      });

      if (!booking) {
        throw new Error('Booking not found');
      }

      // Authorization check based on user role
      if (params.user.role === 'hotel') {
        // Hotel can cancel bookings at their property
        if (booking.hotelId !== params.user.id) {
          throw new Error('Unauthorized to cancel booking for this hotel');
        }
      } else if (params.user.role === 'user') {
        // Regular user can only cancel their own bookings
        if (booking.userId !== params.user.id && params.refundType !== 'admin_refund') {
          throw new Error('Unauthorized to request refund for this booking');
        }
      } else if (params.refundType !== 'admin_refund') {
        throw new Error('Invalid user role for cancellation');
      }

      if (booking.status === 'cancelled') {
        throw new Error('Booking is already cancelled');
      }

      // Check if refund already exists
      const existingRefund = await tx.query.refunds.findFirst({
        where: eq(refunds.bookingId, params.bookingId)
      });

      if (existingRefund) {
        throw new Error('Refund request already exists for this booking');
      }

      // Calculate refund amount - hotels might have different policies
      let refundCalculation;
      if (params.refundType === 'hotel_cancellation') {
        // Hotel cancellation - typically full refund regardless of timing
        refundCalculation = {
          refundAmount: booking.totalAmount,
          cancellationFeeAmount: 0,

        };
      } else {
        //TO-DO
        // User cancellation - apply normal cancellation policy
        // refundCalculation = this.calculateRefundAmount(
        //   booking.totalAmount,
        //   booking.hotel.cancellationFeePercentage,
        //   booking.checkInDate,
        //   booking.hotel.cancellationTimeHours
        // );
        refundCalculation = {
          refundAmount: booking.totalAmount - booking.walletAmountUsed,
          cancellationFeeAmount: 0,

        }
      }

      // Create refund record
      const refundId = uuidv4();
      await tx.insert(refunds).values({
        id: refundId,
        bookingId: params.bookingId,
        originalPaymentId: booking.payment?.id,
        userId: booking.userId, // Always the guest's user ID
        refundType: params.refundType,
        originalAmount: booking.totalAmount,
        cancellationFeeAmount: refundCalculation.cancellationFeeAmount,
        refundAmount: refundCalculation.refundAmount,
        cancellationFeePercentage: 0,
        // cancellationFeePercentage: params.refundType === 'hotel_cancellation' ? 0 : booking.hotel.cancellationFeePercentage,
        refundReason: params.refundReason,
        status: 'pending',
        refundMethod: booking.payment?.paymentMode === 'online' ? 'razorpay' : 'bank_transfer',
        expectedProcessingDays: booking.payment?.paymentMode === 'online' ? 7 : 10,
      });


      await tx.update(bookings)
        .set({
          status: 'cancelled',
          cancellationReason: params.refundReason,
          cancelledBy: params.refundType === 'admin_refund' ? 'admin' : 'user',
          cancelledAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(bookings.id, params.bookingId));

      // Send notifications
      await this.notificationService.sendNotificationFromTemplate('refund_request_created', params.user.id, {
        bookingId: params.bookingId,
        refundAmount: refundCalculation.refundAmount,
        cancellationFeeAmount: refundCalculation.cancellationFeeAmount,
        expectedDays: booking.payment?.paymentMode === 'online' ? 7 : 10
      });

      return {
        refundId,
        refundAmount: refundCalculation.refundAmount,
        cancellationFeeAmount: refundCalculation.cancellationFeeAmount,

        status: 'pending'
      };
    });
  }

  // Get refunds for user
  async getUserRefunds(userId: string, page: number = 1, limit: number = 10) {
    const db = this.fastify.db;
    const offset = (page - 1) * limit;

    const userRefunds = await db.query.refunds.findMany({
      where: eq(refunds.userId, userId),
      with: {
        booking: {
          with: {
            hotel: true,
            room: true
          }
        }
      },
      orderBy: [desc(refunds.createdAt)],
      limit,
      offset
    });

    return userRefunds;
  }

  // Get refund by ID
  async getRefundById(refundId: string, userId?: string) {
    const db = this.fastify.db;

    const refund = await db.query.refunds.findFirst({
      where: userId ?
        and(eq(refunds.id, refundId), eq(refunds.userId, userId)) :
        eq(refunds.id, refundId),
      with: {
        booking: {
          with: {
            hotel: true,
            room: true,
            user: true
          }
        },
        originalPayment: true
      }
    });

    return refund;
  }

  // Process refund (Admin only)
  async processRefund(refundId: string, processedBy: any) {
    const db = this.fastify.db;
    // Removed log('processedBy ',processedBy)
    if (processedBy.role !== UserRole.SUPER_ADMIN) {
      throw new Error('You dont have access to refund this')
    }

    return await db.transaction(async (tx) => {
      const refund = await tx.query.refunds.findFirst({
        where: eq(refunds.id, refundId),
        with: {
          booking: true,
          originalPayment: true,
          user: true
        }
      });

      if (!refund) {
        throw new Error('Refund not found');
      }

      if (refund.status !== 'pending') {
        throw new Error('Refund is not in pending status');
      }

      // Removed log('refund retunred ', refund)

      let wallet = await tx.query.wallets.findFirst({
        where: eq(wallets.userId, refund.userId)
      });

      // Removed log('wallet is ', wallet)

      if (!wallet) {
        const walletId = uuidv4();
        [wallet] = await tx.insert(wallets).values({
          id: walletId,
          userId: refund.userId,
          balance: 0,
          totalEarned: 0,
          totalSpent: 0,
          status: 'active'
        }).returning();
      }
      // Removed log('wallet after  is ', wallet)

      const newBalance = wallet.balance + refund.refundAmount;
      const newTotalEarned = wallet.totalEarned + refund.refundAmount;

      // Removed log('newbalance ', newBalance)
      // Removed log('newTotaleearned ', newTotalEarned)

      // Update wallet balance
      await tx.update(wallets)
        .set({
          balance: newBalance,
          totalEarned: newTotalEarned,
          updatedAt: new Date()
        })
        .where(eq(wallets.id, wallet.id));


      // Removed log('here ')

      // Create transaction record
      const transactionId = uuidv4();
      await tx.insert(walletTransactions).values({
        id: transactionId,
        walletId: wallet.id,
        userId: refund.userId,
        type: 'credit',
        source: 'refund',
        amount: refund.refundAmount,
        balanceAfter: newBalance,
        description: `Refund for booking ${refund.bookingId}`,
        referenceId: refund.bookingId,
        referenceType: 'booking',
        metadata: refund.metadata ? JSON.stringify(refund.metadata) : null
      });

      // Removed log('here ', 2)


      // Update refund status
      await tx.update(refunds)
        .set({
          status: 'processed',
          processedBy,
          processedAt: new Date(),
          refundMethod: 'wallet',
          updatedAt: new Date()
        })
        .where(eq(refunds.id, refundId));

      // Removed log('here 3')
      await this.sendRefundStatusNotifications(
        refundId,
        'Success',
        refund.userId,
        refund.bookingId,
        refund.refundAmount,
        refund.booking?.hotel?.name || 'Hotel'
      );

      return { refundId, status: 'processed', amount: refund.refundAmount };
    });
  }

  // Reject refund (Admin only)
  async rejectRefund(refundId: string, processedBy: string, rejectionReason: string) {
    const db = this.fastify.db;

    return await db.transaction(async (tx) => {
      const refund = await tx.query.refunds.findFirst({
        where: eq(refunds.id, refundId),
        with: { user: true, booking: true }
      });

      if (!refund) {
        throw new Error('Refund not found');
      }

      if (refund.status !== 'pending') {
        throw new Error('Refund is not in pending status');
      }

      // Update refund status
      await tx.update(refunds)
        .set({
          status: 'rejected',
          processedBy,
          processedAt: new Date(),
          rejectionReason,
          updatedAt: new Date()
        })
        .where(eq(refunds.id, refundId));

      // Revert booking status back to confirmed
      await tx.update(bookings)
        .set({
          status: 'confirmed',
          cancellationReason: null,
          cancelledBy: null,
          cancelledAt: null,
          updatedAt: new Date()
        })
        .where(eq(bookings.id, refund.bookingId));

      // Send notification
      await this.sendRefundStatusNotifications(
        refundId,
        'rejected',
        refund.userId,
        refund.bookingId,
        refund.refundAmount,
        refund.booking?.hotel?.name || 'Hotel'
      );

      return { success: true, refundId, status: 'rejected' };
    });
  }

  // Get all refunds (Admin only)
  async getAllRefunds(filters: {
    status?: string;
    refundType?: string;
    page?: number;
    limit?: number;
  }) {
    const db = this.fastify.db;
    const { status, refundType, page = 1, limit = 10 } = filters;
    const offset = (page - 1) * limit;

    let whereConditions = [];
    if (status) whereConditions.push(eq(refunds.status, status));
    if (refundType) whereConditions.push(eq(refunds.refundType, refundType));

    const allRefunds = await db.query.refunds.findMany({
      where: whereConditions.length > 0 ? and(...whereConditions) : undefined,
      with: {
        booking: {
          with: {
            hotel: true,
            room: true,
            user: true
          }
        },
        originalPayment: true
      },
      orderBy: [desc(refunds.createdAt)],
      limit,
      offset
    });

    return allRefunds;
  }
}