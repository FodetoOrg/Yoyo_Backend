//@ts-nocheck
import { FastifyInstance } from 'fastify';
import { eq, and, desc } from 'drizzle-orm';
import { refunds, bookings, payments, hotels, users } from '../models/schema';
import { v4 as uuidv4 } from 'uuid';
import { NotificationService } from './notification.service';

export class RefundService {
  private fastify: FastifyInstance;
  private notificationService: NotificationService;

  constructor() {

    this.notificationService = new NotificationService();
  }

  setFastify(fastify: FastifyInstance) {
    this.fastify = fastify;
    this.notificationService.setFastify(fastify)
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
    console.log('came in refund');

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
          hoursUntilCheckIn: this.calculateHoursUntilCheckIn(booking.checkInDate)
        };
      } else {
        // User cancellation - apply normal cancellation policy
        refundCalculation = this.calculateRefundAmount(
          booking.totalAmount,
          booking.hotel.cancellationFeePercentage,
          booking.checkInDate,
          booking.hotel.cancellationTimeHours
        );
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
        cancellationFeePercentage: params.refundType === 'hotel_cancellation' ? 0 : booking.hotel.cancellationFeePercentage,
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
      await this.notificationService.sendNotificationFromTemplate('refund_request_created', params.userId, {
        bookingId: params.bookingId,
        refundAmount: refundCalculation.refundAmount,
        cancellationFeeAmount: refundCalculation.cancellationFeeAmount,
        expectedDays: booking.payment?.paymentMode === 'online' ? 7 : 10
      });

      return {
        refundId,
        refundAmount: refundCalculation.refundAmount,
        cancellationFeeAmount: refundCalculation.cancellationFeeAmount,
        hoursUntilCheckIn: refundCalculation.hoursUntilCheckIn,
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
  async processRefund(refundId: string, processedBy: string, bankDetails?: any) {
    const db = this.fastify.db;

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

      let razorpayRefundId = null;

      // Process online refund through Razorpay if applicable
      if (refund.refundMethod === 'razorpay' && refund.originalPayment?.razorpayPaymentId) {
        try {
          // Here you would integrate with Razorpay refund API
          // const razorpayRefund = await this.razorpay.payments.refund(
          //   refund.originalPayment.razorpayPaymentId,
          //   { amount: Math.round(refund.refundAmount * 100) }
          // );
          // razorpayRefundId = razorpayRefund.id;
        } catch (error) {
          throw new Error('Failed to process online refund: ' + error.message);
        }
      }

      // Update refund status
      await tx.update(refunds)
        .set({
          status: 'processed',
          processedBy,
          processedAt: new Date(),
          razorpayRefundId,
          bankDetails: bankDetails ? JSON.stringify(bankDetails) : null,
          updatedAt: new Date()
        })
        .where(eq(refunds.id, refundId));

      // Send notification
      await this.notificationService.sendNotificationFromTemplate('refund_processed', refund.userId, {
        refundAmount: refund.refundAmount,
        refundMethod: refund.refundMethod,
        expectedDays: refund.expectedProcessingDays
      });

      return { success: true, refundId, status: 'processed' };
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
      await this.notificationService.sendNotificationFromTemplate('refund_rejected', refund.userId, {
        rejectionReason,
        bookingId: refund.bookingId
      });

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
