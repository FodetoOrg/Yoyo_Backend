// @ts-nocheck
import { FastifyInstance } from 'fastify';
import { bookings, hotels, rooms, users, customerProfiles, coupons, payments, bookingCoupons, bookingAddons, couponUsages, refunds } from '../models/schema';
import { eq, and, desc, asc, count, not, lt, gt, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { NotFoundError, ConflictError } from '../types/errors';
import { CouponService } from './coupon.service';
import { NotificationService } from './notification.service';
import Razorpay from 'razorpay';
import { generateBookingConfirmationEmail } from '../utils/email';
import { RefundService }  from './refund.service'
import { AddonService } from './addon.service';
import { RefundService } from './refund.service';

interface BookingCreateParams {
  userId: string;
  hotelId: string;
  roomId: string;
  checkInDate: Date;
  checkOutDate: Date;
  bookingType: 'daily' | 'hourly';
  totalHours?: number;
  guestCount: number;
  totalAmount: number;
  specialRequests?: string;
  paymentMode?: 'online' | 'offline';
  advanceAmount?: number;
}

export class BookingService {
  private fastify!: FastifyInstance;
  private couponService: CouponService;
  private notificationService: NotificationService;
  private razorpay: Razorpay;
  private addonService: AddonService;
  private refundService:RefundService;

  constructor() {
    this.couponService = new CouponService();
    this.notificationService = new NotificationService();
    this.addonService = new AddonService();
    this.refundService = new RefundService();
    // Initialize Razorpay
    this.razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID || '',
      key_secret: process.env.RAZORPAY_KEY_SECRET || ''
    });
  }

  // Method to set Fastify instance
  setFastify(fastify: FastifyInstance) {
    this.fastify = fastify;
    this.couponService.setFastify(fastify);
    this.notificationService.setFastify(fastify);
    this.addonService.setFastify(fastify);
    this.refundService.setFastify(fastify);
    
  }

  // Check if a room is available for the given dates and guest count
  async checkRoomAvailability(roomId: string, checkInDate: Date, checkOutDate: Date, guestCount: number, bookingType: 'daily' | 'hourly' = 'daily') {
    const db = this.fastify.db;

    // Get room from database
    const room = await db.query.rooms.findFirst({
      where: eq(rooms.id, roomId)
    });

    if (!room || room.status !== 'available') {
      return { available: false, reason: 'Room not found or not available' };
    }

    // Check if room supports the requested booking type
    if (bookingType === 'hourly' && !room.isHourlyBooking) {
      return { available: false, reason: 'Room does not support hourly bookings' };
    }

    if (bookingType === 'daily' && !room.isDailyBooking) {
      return { available: false, reason: 'Room does not support daily bookings' };
    }

    // Check guest capacity
    if (room.capacity < guestCount) {
      return { available: false, reason: `Room capacity (${room.capacity}) is less than requested guests (${guestCount})` };
    }

    // Convert dates to ensure proper comparison (remove milliseconds for consistency)


    console.log('Checking availability for room:', roomId);


    // Check if there are any overlapping bookings
    const overlappingBookings = await db.query.bookings.findMany({
      where: and(
        eq(bookings.roomId, roomId),
        not(eq(bookings.status, 'cancelled')),
        // Check for any date overlap: booking conflicts if checkIn < existing.checkOut AND checkOut > existing.checkIn
        lt(bookings.checkInDate, checkOutDate), // existing booking starts before new booking ends
        gt(bookings.checkOutDate, checkInDate)  // existing booking ends after new booking starts
      )
    });

    if (overlappingBookings.length > 0) {
      console.log('Found overlapping bookings:', overlappingBookings.map(b => ({
        id: b.id,
        checkIn: b.checkInDate,
        checkOut: b.checkOutDate,
        status: b.status,
        bookingType: b.bookingType
      })));
      return { available: false, reason: 'Room is already booked for the selected dates' };
    }

    console.log('Room is available');
    return { available: true, reason: null };
  }
  // Optimized createBooking method
  async createBooking(bookingData: {
    hotelId: string;
    roomId: string;
    userId: string;
    checkIn: Date;
    checkOut: Date;
    bookingType: 'daily' | 'hourly';
    guests: number;
    totalAmount: number;
    frontendPrice: number;
    specialRequests?: string;
    paymentMode?: string;
    advanceAmount?: number;
    couponCode?: string;
    guestName: string;
    guestEmail: string;
    guestPhone: string;
    addons?: string[];
  }) {
    const db = this.fastify.db;
    const bookingId = uuidv4();

    // 1. PRE-TRANSACTION: Validate and prepare data (can fail without side effects)
    const validationResult = await this.validateBookingData(bookingData);
    const { hotel, room, couponValidation, finalAmount, finalPaymentMode } = validationResult;

    // 2. TRANSACTION: Only database operations (keep this minimal and fast)
    const booking = await db.transaction(async (tx) => {
      // Calculate duration based on booking type
      let totalHours = 0;
      let nights = 0;

      if (bookingData.bookingType === 'hourly') {
        totalHours = Math.ceil((bookingData.checkOut.getTime() - bookingData.checkIn.getTime()) / (1000 * 60 * 60));
      } else {
        nights = Math.ceil((bookingData.checkOut.getTime() - bookingData.checkIn.getTime()) / (1000 * 60 * 60 * 24));
        totalHours = nights * 24;
      }

      // Payment calculations
      let requiresOnlinePayment = finalPaymentMode === 'online';
      let paymentDueDate = null;
      let remainingAmount = finalAmount;
      let advanceAmount = 0;

      if (finalPaymentMode === 'offline') {
        paymentDueDate = new Date(bookingData.checkIn + 'Z');
        paymentDueDate.setHours(paymentDueDate.getHours() - 24);

        if (bookingData.advanceAmount && bookingData.advanceAmount > 0) {
          advanceAmount = Math.min(bookingData.advanceAmount, finalAmount);
          remainingAmount = finalAmount - advanceAmount;
        }
      }
      console.log('started inserting ', bookingData.checkIn)
      console.log(bookingData.checkOut)
      // Create booking record
      await tx.insert(bookings).values({
        id: bookingId,
        userId: bookingData.userId,
        hotelId: bookingData.hotelId,
        roomId: bookingData.roomId,
        checkInDate: bookingData.checkIn,
        checkOutDate: bookingData.checkOut,
        bookingType: bookingData.bookingType,
        totalHours: totalHours,
        guestCount: bookingData.guests,
        totalAmount: finalAmount,
        paymentMode: 'offline', // Always start as offline
        requiresOnlinePayment,
        paymentDueDate,
        advanceAmount,
        remainingAmount,
        specialRequests: bookingData.specialRequests,
        status: 'confirmed', // Always confirm booking immediately
        paymentStatus: 'pending',
        guestEmail: bookingData.guestEmail,
        guestName: bookingData.guestName,
        guestPhone: bookingData.guestPhone
      });

      console.log('coupns mapping start')
      // Insert coupon usage if applicable
      if (couponValidation) {
        await tx.insert(bookingCoupons).values({
          id: uuidv4(),
          bookingId: bookingId,
          couponId: couponValidation.coupon.id,
          discountAmount: couponValidation.discountAmount,
        });


        // Update coupon usage count
        await tx.update(coupons)
          .set({
            usedCount: sql`${coupons.usedCount} + 1`,
            updatedAt: new Date()
          })
          .where(eq(coupons.id, couponValidation.coupon.id));

        await tx.insert(couponUsages).values({
          id: uuidv4(),
          bookingId: bookingId,
          couponId: couponValidation.coupon.id,
          hotelId: bookingData.hotelId,
          userId: bookingData.userId
        })
      }

      console.log('pyments')
      // Create payment records
      const paymentId = uuidv4();
      await tx.insert(payments).values({
        id: paymentId,
        bookingId,
        userId: bookingData.userId,
        amount: finalPaymentMode === 'offline' && advanceAmount > 0 ? advanceAmount : finalAmount,
        currency: 'INR',
        paymentType: finalPaymentMode === 'offline' && advanceAmount > 0 ? 'advance' : 'full',
        paymentMethod: finalPaymentMode === 'offline' ? (hotel.defaultPaymentMethod || 'cash') : 'razorpay',
        paymentMode: 'offline',
        status: 'pending',
        transactionDate: new Date(),
      });

      // Create remaining payment record if needed
      if (finalPaymentMode === 'offline' && remainingAmount > 0) {
        const remainingPaymentId = uuidv4();
        await tx.insert(payments).values({
          id: remainingPaymentId,
          bookingId,
          userId: bookingData.userId,
          amount: remainingAmount,
          currency: 'INR',
          paymentType: 'remaining',
          paymentMethod: hotel.defaultPaymentMethod || 'cash',
          paymentMode: 'offline',
          status: 'pending',
          transactionDate: paymentDueDate || new Date(),
        });
      }
      console.log('addons ')

      // Add addons to booking if provided
      if (bookingData.addons && bookingData.addons.length > 0) {
        const data = await this.addonService.addBookingAddons(bookingId, bookingData.addons);
        console.log('data addons us ', data)
        if (data.length > 0) {
          await tx.insert(bookingAddons).values(data);
        }
      }
      console.log('retriuning id ')
      return bookingId;
    });

    // 3. POST-TRANSACTION: Send notifications (async, don't block response)
    this.sendBookingNotifications(bookingId, bookingData, hotel, room, couponValidation)
      .catch(error => {
        this.fastify.log.error('Failed to send booking notifications:', error);
      });

    // 4. Return the booking details
    return await this.getBookingById(bookingId);
  }

  // Separate method for validation (runs before transaction)
  private async validateBookingData(bookingData: any) {
    const db = this.fastify.db;

    // Parallel validation queries
    const [hotel, room] = await Promise.all([
      db.query.hotels.findFirst({
        where: eq(hotels.id, bookingData.hotelId)
      }),
      db.query.rooms.findFirst({
        where: eq(rooms.id, bookingData.roomId)
      })
    ]);

    if (!hotel) throw new Error('Hotel not found');
    if (!room) throw new Error('Room not found');

    // Validate payment mode
    let finalPaymentMode = bookingData.paymentMode || 'offline';

    if (finalPaymentMode === 'online' && !hotel.onlinePaymentEnabled) {
      throw new Error('Online payment is not enabled for this hotel');
    }
    if (finalPaymentMode === 'offline' && !hotel.offlinePaymentEnabled) {
      throw new Error('Offline payment is not enabled for this hotel');
    }

    // Price validation based on booking type
    let expectedPrice = 0;
    let duration = 0;

    if (bookingData.bookingType === 'hourly') {
      duration = Math.ceil((bookingData.checkOut.getTime() - bookingData.checkIn.getTime()) / (1000 * 60 * 60));
      basePrice = room.pricePerHour * duration;
    } else {
      duration = Math.ceil((bookingData.checkOut.getTime() - bookingData.checkIn.getTime()) / (1000 * 60 * 60 * 24));
      expectedPrice = room.pricePerNight * duration;
    }

    // Coupon validation
    let couponValidation = null;
    let finalAmount = bookingData.totalAmount;

    if (bookingData.couponCode) {
      try {
        couponValidation = await this.couponService.validateCoupon(
          bookingData.couponCode,
          bookingData.hotelId,
          room.roomType,
          bookingData.totalAmount,
          bookingData.userId,
          bookingData.bookingType
        );

        if (couponValidation) {
          finalAmount = finalAmount - couponValidation.discountAmount;

          // Validate price with coupon
          if (Math.abs(bookingData.frontendPrice - finalAmount) > 0.01) {
            throw new ConflictError(`Price mismatch: Expected ${finalAmount}, received ${bookingData.frontendPrice}`);
          }
        }
      } catch (error) {
        console.log('error ', error)
        throw new NotFoundError('Coupon Not Found');
      }
    } else {
      // Validate price without coupon
      if (Math.abs(bookingData.frontendPrice - finalAmount) > 0.01) {
        throw new ConflictError(`Price mismatch: Expected ${finalAmount}, received ${bookingData.frontendPrice}`);
      }
    }

    return { hotel, room, couponValidation, finalAmount, finalPaymentMode };
  }

  // Separate async method for notifications (runs after transaction)
  private async sendBookingNotifications(
    bookingId: string,
    bookingData: any,
    hotel: any,
    room: any,
    couponValidation: any
  ) {
    const nights = Math.ceil((bookingData.checkOut.getTime() - bookingData.checkIn.getTime()) / (1000 * 60 * 60 * 24));

    try {
      // Send push notification
      await this.notificationService.sendInstantBookingSuccessNotification(bookingData.userId, {
        title: 'Booking Confirmed! 🎉',
        message: `Your booking at ${hotel.name} has been confirmed. Booking ID: ${bookingId}`,
        type: 'booking_confirmed',
        data: {
          bookingId,
          hotelName: hotel.name,
          checkInDate: bookingData.checkIn.toISOString(),
          checkOutDate: bookingData.checkOut.toISOString(),
        }
      });

      // Send email notification
      await this.notificationService.sendImmediateNotification({
        userId: bookingData.userId,
        type: 'email',
        title: "Booking Confirmation",
        message: generateBookingConfirmationEmail({
          bookingId,
          hotel,
          room,
          guestName: bookingData.guestName,
          guestEmail: bookingData.guestEmail,
          guestPhone: bookingData.guestPhone,
          checkIn: bookingData.checkIn,
          checkOut: bookingData.checkOut,
          guests: bookingData.guests,
          totalAmount: bookingData.totalAmount,
          paymentMode: bookingData.paymentMode,
          status: "confirmed",
          couponValidation,
          nights
        }),
        email: bookingData.guestEmail
      });

      console.log(`Notifications sent successfully for booking ${bookingId}`);
    } catch (error) {
      console.error(`Failed to send notifications for booking ${bookingId}:`, error);
      // Could implement retry logic here or add to a dead letter queue
    }
  }
  // Get booking by ID
  async getBookingById(bookingId: string) {
    const db = this.fastify.db;

    const booking = await db.query.bookings.findFirst({
      where: eq(bookings.id, bookingId),
      with: {
        user: true,
        hotel: true,
        room: true,
        payment: true
      }
    });

    if (!booking) {
      return null;
    }

    // Get booking addons
    const bookingAddons = await this.addonService.getBookingAddons(booking.id);

    // Format booking data
    return {
      id: booking.id,
      userId: booking.userId,
      hotelId: booking.hotelId,
      roomId: booking.roomId,
      checkInDate: booking.checkInDate,
      checkOutDate: booking.checkOutDate,
      bookingType: booking.bookingType,
      totalHours: booking.totalHours,
      guestCount: booking.guestCount,
      totalAmount: booking.totalAmount,
      paymentMode: booking.paymentMode,
      requiresOnlinePayment: booking.requiresOnlinePayment,
      paymentDueDate: booking.paymentDueDate,
      advanceAmount: booking.advanceAmount,
      remainingAmount: booking.remainingAmount,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      specialRequests: booking.specialRequests,
      bookingDate: booking.bookingDate,
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt,
      user: {
        id: booking.user.id,
        name: booking.user.name,
        phone: booking.user.phone,
        email: booking.user.email
      },
      hotel: {
        id: booking.hotel.id,
        name: booking.hotel.name,
        address: booking.hotel.address,
        city: booking.hotel.city
      },
      room: {
        id: booking.room.id,
        name: booking.room.name,
        roomType: booking.room.roomType,
        pricePerNight: booking.room.pricePerNight,
        pricePerHour: booking.room.pricePerHour
      },
      payment: {
        id: booking.payment.id,
        amount: booking.payment.amount,
        currency: booking.payment.currency,
        status: booking.payment.status,
        paymentMethod: booking.payment.paymentMethod,
        transactionDate: booking.payment.transactionDate
      },
      addons: bookingAddons.map(ba => ({
        id: ba.id,
        addonId: ba.addonId,
        name: ba.addon.name,
        description: ba.addon.description,
        image: ba.addon.image,
        quantity: ba.quantity,
        unitPrice: ba.unitPrice,
        totalPrice: ba.totalPrice
      }))
    };
  }

  // Get bookings by user ID
  async getBookingsByUserId(userId: string, options: { status?: string; page?: number; limit?: number } = {}) {
    const db = this.fastify.db;
    const { status, page = 1, limit = 10 } = options;
    const offset = (page - 1) * limit;

    // Build where conditions
    const whereConditions = [eq(bookings.userId, userId)];
    if (status) {
      whereConditions.push(eq(bookings.status, status));
    }

    // Get total count
    const totalResult = await db.query.bookings.findMany({
      where: and(...whereConditions)
    });
    const total = totalResult.length;

    const userBookings = await db.query.bookings.findMany({
      where: and(...whereConditions),
      with: {
        hotel: true,
        room: true
      },
      orderBy: (bookings, { desc }) => [desc(bookings.createdAt)],
      limit,
      offset
    });

    // Format bookings with Promise.all to handle async operations
    const formattedBookings = await Promise.all(
      userBookings.map(async (booking) => ({
        id: booking.id,
        checkInDate: booking.checkInDate,
        checkOutDate: booking.checkOutDate,
        bookingType: booking.bookingType,
        totalAmount: booking.totalAmount,
        status: booking.status,
        paymentStatus: booking.paymentStatus,
        bookingDate: booking.bookingDate,
        hotel: {
          id: booking.hotel.id,
          name: booking.hotel.name,
          city: booking.hotel.city
        },
        room: {
          id: booking.room.id,
          name: booking.room.name,
          roomType: booking.room.roomType
        },
        addons: await this.addonService.getBookingAddons(booking.id)
      }))
    );

    return {
      bookings: formattedBookings,
      total,
      page,
      limit
    };
  }

  // Get bookings by hotel ID - FIXED
  async getBookingsByHotelId(hotelId: string, options: { status?: string; page?: number; limit?: number } = {}) {
    const db = this.fastify.db;
    const { status, page = 1, limit = 10 } = options;
    const offset = (page - 1) * limit;

    // Build where conditions
    const whereConditions = [eq(bookings.hotelId, hotelId)];
    if (status) {
      whereConditions.push(eq(bookings.status, status));
    }

    // Get total count
    const totalResult = await db.query.bookings.findMany({
      where: and(...whereConditions)
    });
    const total = totalResult.length;

    const hotelBookings = await db.query.bookings.findMany({
      where: and(...whereConditions),
      with: {
        user: true,
        room: true
      },
      orderBy: (bookings, { desc }) => [desc(bookings.createdAt)],
      limit,
      offset
    });

    // Commission rate (10%)
    const commissionRate = 0.10;

    // Format bookings with Promise.all to handle async operations
    const formattedBookings = await Promise.all(
      hotelBookings.map(async (booking) => {
        const commissionAmount = Number(booking.totalAmount || 0) * commissionRate;

        return {
          id: booking.id,
          checkInDate: booking.checkInDate,
          checkOutDate: booking.checkOutDate,
          bookingType: booking.bookingType,
          guestCount: booking.guestCount,
          totalAmount: booking.totalAmount,
          commissionAmount: commissionAmount,
          paymentMode: booking.paymentMode,
          status: booking.status,
          paymentStatus: booking.paymentStatus,
          bookingDate: booking.bookingDate,
          user: {
            id: booking.user.id,
            name: booking.user.name,
            phone: booking.user.phone
          },
          room: {
            id: booking.room.id,
            name: booking.room.name,
            roomType: booking.room.roomType
          },
          addons: await this.addonService.getBookingAddons(booking.id)
        };
      })
    );

    return {
      bookings: formattedBookings,
      total,
      page,
      limit
    };
  }
  // Get all bookings (admin only) - FIXED
  async getAllBookings(options: { status?: string; page?: number; limit?: number } = {}) {
    const db = this.fastify.db;
    const { status, page = 1, limit = 10 } = options;
    const offset = (page - 1) * limit;

    // Build where conditions
    let whereConditions = [];
    if (status) {
      whereConditions.push(eq(bookings.status, status));
    }

    // Get total count
    const totalResult = await db.query.bookings.findMany({
      where: whereConditions.length > 0 ? and(...whereConditions) : undefined
    });
    const total = totalResult.length;

    const allBookings = await db.query.bookings.findMany({
      where: whereConditions.length > 0 ? and(...whereConditions) : undefined,
      with: {
        user: true,
        hotel: true,
        room: true
      },
      orderBy: (bookings, { desc }) => [desc(bookings.createdAt)],
      limit,
      offset
    });

    // Commission rate (10%)
    const commissionRate = 0.10;

    // Format bookings with Promise.all to handle async operations
    const formattedBookings = await Promise.all(
      allBookings.map(async (booking) => {
        const commissionAmount = Number(booking.totalAmount || 0) * commissionRate;

        return {
          id: booking.id,
          checkInDate: booking.checkInDate,
          checkOutDate: booking.checkOutDate,
          bookingType: booking.bookingType,
          guestCount: booking.guestCount,
          totalAmount: booking.totalAmount,
          commissionAmount: commissionAmount,
          paymentMode: booking.paymentMode,
          status: booking.status,
          paymentStatus: booking.paymentStatus,
          bookingDate: booking.bookingDate,
          user: {
            id: booking.user.id,
            name: booking.user.name,
            phone: booking.user.phone
          },
          hotel: {
            id: booking.hotel.id,
            name: booking.hotel.name,
            city: booking.hotel.city
          },
          room: {
            id: booking.room.id,
            name: booking.room.name,
            roomType: booking.room.roomType
          },
          addons: await this.addonService.getBookingAddons(booking.id)
        };
      })
    );

    return {
      bookings: formattedBookings,
      total,
      page,
      limit
    };
  }

  // Cancel a booking
  async cancelBooking(bookingId: string, userId: string, cancelReason: string) {
    const db = this.fastify.db;

    // Find the booking first to validate
    const booking = await db.query.bookings.findFirst({
      where: and(eq(bookings.id, bookingId), eq(bookings.userId, userId)),
      with: {
        payment: true,
        hotel: true
      },
    });

    console.log('came in booking ',booking)

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    if (booking.status === 'cancelled') {
      throw new ConflictError('Booking is already cancelled');
    }

    // Check if payment was made - if yes, create refund request
    if (booking.payment && booking.payment.status === 'completed') {
      // Import RefundService here to avoid circular dependency


      const refundResult = await this.refundService.createRefundRequest({
        bookingId,
        userId,
        refundReason: cancelReason,
        refundType: 'cancellation'
      });

      return {
        message: 'Booking cancelled successfully. Refund request created.',
        refundInfo: refundResult
      };
    } else {
      // No payment made, just cancel the booking
      await db.update(bookings)
        .set({
          status: 'cancelled',
          cancellationReason: cancelReason,
          cancelledBy: 'user',
          cancelledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(bookings.id, bookingId));

      return {
        message: 'Booking cancelled successfully. No refund required as payment was not completed.',
        refundInfo: null
      };
    }
  }

  // Update booking status
  async updateBookingStatus(bookingId: string, status: string, updatedBy: string, reason?: string) {
    const db = this.fastify.db;

    const updateData: any = {
      status,
      updatedAt: new Date()
    };

    // Add cancel-specific fields if status is cancelled
    if (status === 'cancelled') {
      updateData.cancelReason = reason;
      updateData.cancelledBy = updatedBy;
      updateData.cancelledAt = new Date();
    }

    // Add check-in timestamp if status is checked-in
    if (status === 'checked-in') {
      updateData.checkedInAt = new Date();
    }

    // Add completion timestamp if status is completed
    if (status === 'completed') {
      updateData.completedAt = new Date();
    }

    await db
      .update(bookings)
      .set(updateData)
      .where(eq(bookings.id, bookingId));

    // Send notification for status update
    const booking = await this.getBookingById(bookingId);
    if (booking) {
      try {
        let notificationMessage = '';
        switch (status) {
          case 'confirmed':
            notificationMessage = `Your booking at ${booking.hotel.name} has been confirmed`;
            break;
          case 'cancelled':
            notificationMessage = `Your booking at ${booking.hotel.name} has been cancelled. Reason: ${reason}`;
            break;
          case 'checked-in':
            notificationMessage = `You have been checked in at ${booking.hotel.name}`;
            break;
          case 'completed':
            notificationMessage = `Your stay at ${booking.hotel.name} has been completed. Thank you for choosing us!`;
            break;
          default:
            notificationMessage = `Your booking status has been updated to ${status}`;
        }

        await this.notificationService.sendInstantBookingSuccessNotification(booking.userId, {
          title: 'Booking Status Updated',
          message: notificationMessage,
          type: 'booking_status_update',
          data: {
            bookingId,
            status,
            hotelName: booking.hotel.name,
          }
        });
      } catch (error) {
        this.fastify.log.error('Failed to send booking status update notification:', error);
      }
    }

    return booking;
  }

  // Update guest details
  async updateGuestDetails(bookingId: string, guestDetails: {
    guestName: string;
    guestEmail: string;
    guestPhone: string;
  }) {
    const db = this.fastify.db;

    await db
      .update(bookings)
      .set({
        guestName: guestDetails.guestName,
        guestEmail: guestDetails.guestEmail,
        guestPhone: guestDetails.guestPhone,
        updatedAt: new Date()
      })
      .where(eq(bookings.id, bookingId));

    const booking = await this.getBookingById(bookingId);

    if (booking) {
      // try {
      //   // Send push notification
      //   await this.notificationService.sendInstantBookingSuccessNotification(booking.userId, {
      //     title: 'Guest Details Updated',
      //     message: `Guest details for your booking at ${booking.hotel.name} have been updated`,
      //     type: 'guest_details_update',
      //     data: {
      //       bookingId,
      //       hotelName: booking.hotel.name,
      //     }
      //   });

      //   // Send email notification
      //   await this.notificationService.sendImmediateNotification({
      //     userId: booking.userId,
      //     type: 'email',
      //     title: "Guest Details Updated",
      //     message: `
      //       <h2>Guest Details Updated</h2>
      //       <p>Dear Guest,</p>
      //       <p>Your guest details for booking <strong>${bookingId}</strong> at <strong>${booking.hotel.name}</strong> have been updated.</p>
      //       <p>Updated Details:</p>
      //       <ul>
      //         <li><strong>Name:</strong> ${guestDetails.guestName}</li>
      //         <li><strong>Email:</strong> ${guestDetails.guestEmail}</li>
      //         <li><strong>Phone:</strong> ${guestDetails.guestPhone}</li>
      //       </ul>
      //       <p>If you did not make this change, please contact us immediately.</p>
      //       <p>Thank you for choosing ${booking.hotel.name}!</p>
      //     `,
      //     email: guestDetails.guestEmail
      //   });
      // } catch (error) {
      //   this.fastify.log.error('Failed to send guest details update notification:', error);
      // }
    }

    return booking;
  }

  // Create payment order with Razorpay
  async createPaymentOrder(bookingId: string, amount: number) {
    try {
      const options = {
        amount: amount * 100, // Razorpay expects amount in smallest currency unit (paise)
        currency: 'INR',
        receipt: `receipt_${bookingId}`,
        payment_capture: 1
      };

      const order = await this.razorpay.orders.create(options);

      // Save order to database
      await this.savePaymentOrder(bookingId, order);

      return {
        orderId: order.id,
        amount: order.amount / 100, // Convert back to rupees
        currency: order.currency
      };
    } catch (error) {
      console.error('Error creating Razorpay order:', error);
      throw new Error('Failed to create payment order');
    }
  }

  // Save Razorpay order to database
  private async savePaymentOrder(bookingId: string, order: any) {
    const db = this.fastify.db;
    const booking = await this.getBookingById(bookingId);

    if (!booking) {
      throw new Error('Booking not found');
    }

    const paymentId = uuidv4();

    await db.insert(payments).values({
      id: paymentId,
      bookingId,
      userId: booking.userId,
      amount: order.amount / 100, // Convert from paise to rupees
      currency: order.currency,
      razorpayOrderId: order.id,
      status: 'pending',
    });
  }

  // Get checkout price details
  async getCheckoutPriceDetails(roomId: string, checkInDate: Date, checkOutDate: Date, guestCount: number, bookingType: 'daily' | 'hourly' = 'daily') {
    const db = this.fastify.db;

    // Get room details
    const room = await db.query.rooms.findFirst({
      where: eq(rooms.id, roomId),
      with: {
        hotel: true      }
    });

    if (!room) {
      throw new Error('Room not found');
    }

    // Check availability
    const availabilityCheck = await this.checkRoomAvailability(roomId, checkInDate, checkOutDate, guestCount);
    if (!availabilityCheck.available) {
      throw new Error(availabilityCheck.reason || 'Room not available');
    }

    // Calculate pricing based on booking type
    let duration = 0;
    let basePrice = 0;
    let priceDetails: any = {};

    if (bookingType === 'hourly') {
      duration = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60));
      basePrice = room.pricePerHour * duration;
      priceDetails = {
        pricePerHour: room.pricePerHour,
        hours: duration,
      };
    } else {
      duration = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
      basePrice = room.pricePerNight * duration;
      priceDetails = {
        pricePerNight: room.pricePerNight,
        nights: duration,
      };
    }

    // You can add additional charges, taxes, etc. here
    const taxes = basePrice * 0.12; // 12% GST
    const totalAmount = basePrice + taxes;

    return {
      roomId: room.id,
      roomName: room.name,
      bookingType,
      ...priceDetails,
      basePrice,
      taxes,
      totalAmount,
      currency: 'INR',
      checkInDate,
      checkOutDate,
      guestCount,
      hotelName: room.hotel.name,
      available: true
    };
  }

  // Verify payment and update status
  async verifyPayment(bookingId: string, razorpayPaymentId: string, razorpayOrderId: string, razorpaySignature: string) {
    const db = this.fastify.db;

    // In a real-world implementation, we would verify the signature here
    // using Razorpay's SDK
    const isValidPayment = true; // Replace with actual verification

    if (isValidPayment) {
      // Update payment in database
      await db
        .update(payments)
        .set({
          razorpayPaymentId,
          razorpaySignature,
          paymentMethod: 'razorpay',
          status: 'completed',
          updatedAt: new Date()
        })
        .where(and(
          eq(payments.bookingId, bookingId),
          eq(payments.razorpayOrderId, razorpayOrderId)
        ));

      // Update booking status
      await db
        .update(bookings)
        .set({
          status: 'confirmed',
          paymentStatus: 'completed',
          updatedAt: new Date()
        })
        .where(eq(bookings.id, bookingId));

      return true;
    } else {
      throw new Error('Payment verification failed');
    }
  }

  // Get detailed booking information for user
  async getBookingDetails(bookingId: string, userId: string) {
    const db = this.fastify.db;

    const booking = await db.query.bookings.findFirst({
      where: eq(bookings.id, bookingId),
      with: {
        user: true,
        hotel: {
          with: {
            images: true
          }
        },
        room: {
          with: {
            roomType: true
          }
        },
        payment: true
      }
    });

    if (!booking) {
      return null;
    }

    // Check if user is authorized to view this booking
    if (booking.userId !== userId) {
      throw new Error('Unauthorized. You do not have permission to view this booking');
    }

    // Get refund information if exists
    const refundInfo = await db.query.refunds.findFirst({
      where: eq(refunds.bookingId, bookingId)
    });

    // Calculate nights
    // const checkInDate = new Date(booking.checkInDate);
    // const checkOutDate = new Date(booking.checkOutDate);
    // const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));

    // Calculate price breakdown
    let roomRate = 0;

    let nights = 0;
    // let subTotal = 0;
    console.log('booking.checkInDate ', booking.checkInDate)
    const checkInDate = new Date(booking.checkInDate);
    const checkOutDate = new Date(booking.checkOutDate);
    let subtotal = 0;

    if (booking.bookingType === 'hourly') {
      const diffTime = Math.abs(checkOutDate.getTime() - checkInDate.getTime());
      const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
      nights = diffHours
      subtotal = booking.room.pricePerHour * diffHours;
      roomRate = booking.room.pricePerHour;

    } else {
      const diffTime = Math.abs(checkOutDate.getTime() - checkInDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      nights = diffDays
      subtotal = booking.room.pricePerNight * diffDays;
      roomRate = booking.room.pricePerNight;
    }
    const taxes = 0; // 12% GST
    const serviceFee = 0; // Fixed service fee
    const totalCalculated = subtotal + taxes + serviceFee;

    // Determine status based on dates and booking status
    let status = booking.status;
    const now = new Date();
    // if (booking.status === 'confirmed') {
    //   if (now < checkInDate) {
    //     status = 'upcoming';
    //   } else if (now > checkOutDate) {
    //     status = 'completed';
    //   } else {
    //     status = 'confirmed';
    //   }
    // }

    console.log('booking ', booking)

    console.log('booking.hotel.amenities ', booking.hotel.amenities)

    // Get amenities (assuming these are stored in room type or hotel)
    const amenities = JSON.parse(booking.hotel.amenities) || []

    // Get booking addons
    const bookingAddons = await this.addonService.getBookingAddons(booking.id);

    console.log('checkin date ', checkInDate)
    console.log('checkout ', checkOutDate)

    return {
      id: booking.id,
      bookingReference: `REF${booking.id.slice(-9).toUpperCase()}`,
      status,
      bookingType: booking.bookingType,
      hotelName: booking.hotel.name,
      hotelPhone: booking.hotel.contactNumber || '+91 9876543210',
      hotelEmail: booking.hotel.contactEmail || 'info@hotel.com',
      address: `${booking.hotel.address}, ${booking.hotel.city}, ${booking.hotel.state}`,
      image: booking.hotel.images?.[0]?.url || 'https://example.com/hotel.jpg',
      roomType: booking.room.roomType?.name || booking.room.name,
      checkIn: checkInDate,
      checkOut: checkOutDate,
      guests: booking.guestCount,
      onlinePaymentEnabled: booking.hotel.onlinePaymentEnabled,
      guestName:booking.guestName,
      guestEmail:booking.guestEmail,
      guestPhone:booking.guestPhone,
      nights,
      paymentStaus: booking.payment.status,
      paymentAmount: booking.payment.amount,
      amenities,
      latitude: booking.hotel.mapCoordinates.split(",")[0],
      longitude: booking.hotel.mapCoordinates.split(",")[1],
      priceBreakdown: {
        roomRate,
        subtotal,
        taxes,
        serviceFee
      },
      totalAmount: booking.totalAmount,
      cancellationPolicy: booking.hotel.cancellationPolicy || 'Free cancellation up to 24 hours before check-in. After that, a 1-night charge will apply.',
      refundInfo: refundInfo ? {
        id: refundInfo.id,
        refundType: refundInfo.refundType,
        originalAmount: refundInfo.originalAmount,
        cancellationFeeAmount: refundInfo.cancellationFeeAmount,
        refundAmount: refundInfo.refundAmount,
        cancellationFeePercentage: refundInfo.cancellationFeePercentage,
        refundReason: refundInfo.refundReason,
        status: refundInfo.status,
        refundMethod: refundInfo.refundMethod,
        expectedProcessingDays: refundInfo.expectedProcessingDays,
        processedAt: refundInfo.processedAt,
        rejectionReason: refundInfo.rejectionReason,
        createdAt: refundInfo.createdAt
      } : null,
      addons: bookingAddons.map(ba => ({
        id: ba.id,
        addonId: ba.addonId,
        name: ba.addon.name,
        description: ba.addon.description,
        image: ba.addon.image,
        quantity: ba.quantity,
        unitPrice: ba.unitPrice,
        totalPrice: ba.totalPrice
      }))
    };
  }
}