// @ts-nocheck
import { FastifyInstance } from 'fastify';
import { bookings, hotels, rooms, users, customerProfiles, coupons, payments, bookingCoupons, bookingAddons, couponUsages, refunds, hotelReviews, configurations, roomHourlyStays } from '../models/schema';
import { eq, and, desc, asc, count, not, lt, gt, sql, lte, inArray } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { NotFoundError, ConflictError } from '../types/errors';
import { CouponService } from './coupon.service';
import { NotificationService } from './notification.service';
import Razorpay from 'razorpay';
import { generateBookingConfirmationEmail } from '../utils/email';
import { RefundService } from './refund.service'
import { AddonService } from './addon.service';
import { UserRole } from '../types/common';

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
  private refundService: RefundService;

  constructor() {
    this.couponService = new CouponService();
    this.notificationService = new NotificationService();
    this.addonService = new AddonService(this.fastify);
    this.refundService = new RefundService(this.fastify);
    // Initialize Razorpay
    this.razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID || '',
      key_secret: process.env.RAZORPAY_KEY_SECRET || ''
    });
  }

  async cancelNoShowBookings(bufferMinutes = 60) {
    const db = this.fastify.db;
    const now = new Date();
    const cutoff = new Date(now.getTime() - bufferMinutes * 60 * 1000);
    const istOffset = 5.5 * 60 * 60 * 1000; // 5:30 hours in milliseconds
    const cutoffIST = new Date(cutoff.getTime() + istOffset);

    console.log('Current time (local):', now.toString());
    console.log('Current time (UTC):', now.toISOString());
    console.log('Cutoff time (UTC):', cutoff.toISOString());
    console.log('Booking check-in (UTC):', new Date('2025-08-11T13:00:00.000Z').toISOString());

    console.log('Cutoff in IST equivalent:', cutoffIST.toISOString());
    console.log('cutoff ', cutoff)
    const candidatesAll = await db.query.bookings.findMany({
      where: and(
        eq(bookings.status, 'confirmed'),
        // lte(bookings.checkInDate, cutoff)
      ),
      with: { hotel: true }, // for notification message
      columns: { id: true, userId: true, checkInDate: true }
    });
    console.log('candidatesAll ', candidatesAll)

    // Find candidates (still confirmed, missed check-in+buffer)
    const candidates = await db.query.bookings.findMany({
      where: and(
        eq(bookings.status, 'confirmed'),
        lte(bookings.checkInDate, cutoffIST)
      ),
      with: { hotel: true }, // for notification message
      columns: { id: true, userId: true, checkInDate: true }
    });

    console.log('candidates ', candidates)

    // return {
    //   cancelled: 0
    // }

    if (candidates.length === 0) return { cancelled: 0 };

    const ids = candidates.map(b => b.id);

    await db.transaction(async (tx) => {
      await tx.update(bookings).set({
        status: 'cancelled',
        cancelReason: `Auto-cancel: no-show after ${bufferMinutes} min`,
        cancelledBy: 'system',
        cancelledAt: now,
        updatedAt: now
      }).where(inArray(bookings.id, ids));

      // Optional: touch related payments if needed (example)
      await tx.update(payments).set({ status: 'cancelled', updatedAt: now })
        .where(inArray(payments.bookingId, ids));
    });

    // Notify after commit
    for (const b of candidates) {
      try {
        await this.notificationService.sendInstantBookingSuccessNotification(b.userId, {
          title: 'Booking Cancelled (No-show)',
          message: `Your booking at ${b.hotel.name} was cancelled after a 1-hour buffer.`,
          type: 'booking_status_update',
          data: { bookingId: b.id, status: 'cancelled', hotelName: b.hotel.name }
        });
      } catch (err) {
        this.fastify.log.error('No-show notify failed:', err);
      }
    }

    return { cancelled: candidates.length };
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

    if (!room) {
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
    console.log(checkInDate)
    console.log(checkOutDate)


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
      // console.log('Found overlapping bookings:', overlappingBookings.map(b => ({
      //   id: b.id,
      //   checkIn: b.checkInDate,
      //   checkOut: b.checkOutDate,
      //   status: b.status,
      //   bookingType: b.bookingType
      // })));
      return { available: false, reason: 'Room is already booked for the selected dates' };
    }

    // console.log('Room is available');
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
    addonTotalCalcluated: number;
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
    const { hotel, room, couponValidation, finalAmount, finalPaymentMode, gstAmount, platformFeeAmount, basePrice } = validationResult;

    console.log('validationresult is ', validationResult)
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






      const discountAmount = couponValidation ? couponValidation.discountAmount : 0;

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
        roomCharge: basePrice,
        gstAmount,
        platformFee: platformFeeAmount,
        discountAmount,
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


      // Add addons to booking if provided
      if (bookingData.addons && bookingData.addons.length > 0) {
        const data = await this.addonService.addBookingAddons(bookingId, bookingData.addons);

        if (data.length > 0) {
          await tx.insert(bookingAddons).values(data);
        }
      }

      return bookingId;
    });

    console.log('calling notifications')
    // 3. POST-TRANSACTION: Send notifications (async, don't block response)
    setImmediate(async () => {
      try {
        const bookingDetails = await this.getBookingById(booking); // Fetch details to send in notification
        if (!bookingDetails) {
          console.error(`Failed to fetch booking details for notification: ${booking}`);
          return;
        }

        const nights = Math.ceil((bookingData.checkOut.getTime() - bookingData.checkIn.getTime()) / (1000 * 60 * 60 * 24));

        // Send immediate push notification for successful booking
        await this.notificationService.sendInstantBookingSuccessNotification(bookingData.userId, {
          title: 'Booking Created Successfully! 🎉',
          message: `Your booking at ${hotel.name} has been created for ${new Date(bookingData.checkIn).toLocaleDateString()}`,
          type: 'booking_created',
          data: {
            bookingId: booking,
            hotelName: hotel.name,
            checkInDate: new Date(bookingData.checkIn).toLocaleDateString(),
            checkOutDate: new Date(bookingData.checkOut).toLocaleDateString(),
            totalAmount: bookingData.totalAmount,
            status: 'confirmed',
            guests: bookingData.guests
          }
        });

        // Send immediate email notification
        await this.notificationService.sendImmediateNotification({
          userId: bookingData.userId,
          type: 'email',
          title: 'Booking Confirmation - ' + hotel.name,
          message: `
            <h2>🎉 Booking Confirmed!</h2>
            <p>Dear ${bookingData.guestName},</p>
            <p>Your booking has been successfully created and confirmed!</p>
            <div style="background: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 8px;">
              <h3>Booking Details:</h3>
              <p><strong>Hotel:</strong> ${hotel.name}</p>
              <p><strong>Booking ID:</strong> ${booking}</p>
              <p><strong>Check-in:</strong> ${new Date(bookingData.checkIn).toLocaleDateString()}</p>
              <p><strong>Check-out:</strong> ${new Date(bookingData.checkOut).toLocaleDateString()}</p>
              <p><strong>Guests:</strong> ${bookingData.guests}</p>
              <p><strong>Total Amount:</strong> ₹${bookingData.frontendPrice}</p>
              <p><strong>Payment Mode:</strong> ${bookingData.paymentMode}</p>
            </div>
            <p>Thank you for choosing our service!</p>
            <p>Have a wonderful stay! 🏨</p>
          `,
          email: bookingData.guestEmail,
          source: 'booking_created',
          sourceId: booking
        });

      } catch (error) {
        console.error('Failed to send immediate booking notifications:', error);
        // Fallback to queue
        await this.notificationService.queueNotification({
          userId: bookingData.userId,
          type: 'push',
          priority: 1,
          title: 'Booking Created Successfully! 🎉',
          message: `Your booking at ${hotel.name} has been created`,
          data: {
            bookingId: booking,
            hotelName: hotel.name,
            checkInDate: new Date(bookingData.checkIn).toLocaleDateString(),
            checkOutDate: new Date(bookingData.checkOut).toLocaleDateString()
          },
          source: 'booking_created_fallback'
        });
      }
    });

    // 4. Return the booking details
    return await this.getBookingById(bookingId);
  }

  // Separate method for validation (runs before transaction)
  private async validateBookingData(bookingData: any) {
    const db = this.fastify.db;

    console.log('came here ')
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
    let basePrice = 0;
    console.log('came here  2')
    if (bookingData.bookingType === 'hourly') {
      duration = Math.ceil((bookingData.checkOut.getTime() - bookingData.checkIn.getTime()) / (1000 * 60 * 60));

      console.log('hourlStay')
      const hourlStay = await db.query.roomHourlyStays.findFirst({
        where: and(eq(roomHourlyStays.roomId, bookingData.roomId), eq(roomHourlyStays.hours, duration))
      })
      console.log('hourlStay is ', hourlStay)
      if (!hourlStay) {
        throw new Error('The selected rooms have been booked in the meantime. Please choose different dates or rooms.')
      }
      basePrice = hourlStay.price


    } else {
      duration = Math.ceil((bookingData.checkOut.getTime() - bookingData.checkIn.getTime()) / (1000 * 60 * 60 * 24));
      basePrice = room.pricePerNight * duration;
    }
    console.log('came here  3')

    // Get platform fee configuration
    const platformFeeConfig = await db.query.configurations.findFirst({
      where: eq(configurations.key, 'platform_fee')
    });
    const platformFeePercentage = platformFeeConfig ? parseFloat(platformFeeConfig.value) : 0;

    // Calculate expected price with fees
    const gstAmount = (basePrice + bookingData.addonTotalCalcluated) * (hotel.gstPercentage / 100);
    const platformFeeAmount = platformFeePercentage;
    expectedPrice = basePrice + gstAmount + platformFeeAmount + bookingData.addonTotalCalcluated;

    // Coupon validation
    let couponValidation = null;
    let finalAmount = expectedPrice;

    console.log('finalAmount is came ', finalAmount)

    if (bookingData.couponCode) {
      try {
        couponValidation = await this.couponService.validateCoupon(
          bookingData.couponCode,
          bookingData.hotelId,
          room.roomTypeId,
          basePrice + bookingData.addonTotalCalcluated,
          bookingData.userId,
          bookingData.bookingType
        );

        console.log('couponValidation ', couponValidation)

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

    return { hotel, room, couponValidation, finalAmount, finalPaymentMode, gstAmount, platformFeeAmount, basePrice };
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

    console.log('in notifications ')
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

      // Send web push notification
      await this.notificationService.sendWebPushNotification({
        userId: bookingData.userId,
        title: 'Booking Confirmed! 🎉',
        message: `Your booking at ${hotel.name} has been confirmed. Check-in: ${bookingData.checkIn.toLocaleDateString()}`,
        type: 'success',
        requireInteraction: true,
        url: `/bookings/${bookingId}`,
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


    } catch (error) {
      console.log(`Failed to send notifications for booking ${bookingId}:`, error);
      // Could implement retry logic here or add to a dead letter queue
      await this.notificationService.queueNotification({
        userId: bookingData.userId,
        type: 'push',
        priority: 1,
        title: 'Booking Created',
        message: `Your booking at ${hotel.name} has been created successfully`,
        data: {
          bookingId,
          hotelName: hotel.name,
          checkIn: bookingData.checkInDate,
          checkOut: bookingData.checkOutDate
        },
        source: 'booking_created'
      });
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
        room: {
          with: {
            images: true
          }
        }
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
          roomType: booking.room.roomType,
          image: booking.room.images[0].url || null
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
  async cancelBooking(bookingId: string, user: any, cancelReason: string) {
    const db = this.fastify.db;

    // Build query based on user role
    let whereCondition;
    if (user.role === 'hotel') {
      // Hotel can cancel bookings at their property
      // Assuming the hotel user object has the hotel ID or we need to find it
      whereCondition = eq(bookings.id, bookingId);
    } else {
      // Regular user can only cancel their own bookings
      whereCondition = and(
        eq(bookings.id, bookingId),
        eq(bookings.userId, user.id)
      );
    }

    // Find the booking first to validate
    const booking = await db.query.bookings.findFirst({
      where: whereCondition,
      with: {
        payment: true,
        hotel: true,
        user: true
      },
    });



    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    // Additional authorization check for hotels
    if (user.role === 'hotel') {
      // For hotel users, verify they own this hotel
      // You might need to adjust this based on how hotel users are linked to hotels
      // Option 1: If user.id is the hotel ID
      // if (booking.hotelId !== user.id) {
      //   throw new NotFoundError('Unauthorized to cancel this booking');
      // }
      // Option 2: If you need to query hotel ownership differently
      const hotelOwnership = await db.query.hotels.findFirst({
        where: and(eq(hotels.id, booking.hotelId), eq(hotels.ownerId, user.id))
      });
      if (!hotelOwnership) {
        throw new NotFoundError('Unauthorized to cancel this booking');
      }
    }

    if (booking.status === 'cancelled') {
      throw new ConflictError('Booking is already cancelled');
    }

    // Check if payment was made - if yes, create refund request
    if (booking.payment && booking.payment.status === 'completed') {
      const refundResult = await this.refundService.createRefundRequest({
        bookingId,
        user, // Pass the entire user object
        refundReason: cancelReason,
        refundType: user.role === 'hotel' ? 'hotel_cancellation' : 'cancellation'
      });
      // Send immediate cancellation notifications
      setImmediate(async () => {
        try {
          // Send immediate push notification
          await this.notificationService.sendInstantBookingSuccessNotification(booking.userId, {
            title: 'Booking Cancelled & Refund Initiated 💰',
            message: `Your booking at ${booking.hotel.name} has been cancelled. Refund request initiated.`,
            type: 'booking_cancelled',
            data: {
              bookingId,
              hotelName: booking.hotel.name,
              cancelReason,
              refundInitiated: true,
              cancelledBy: user.role === 'hotel' ? 'hotel' : 'user'
            }
          });

          // Send immediate email notification
          await this.notificationService.sendImmediateNotification({
            userId: booking.userId,
            type: 'email',
            title: 'Booking Cancelled & Refund Initiated - ' + booking.hotel.name,
            message: `
              <h2>❌ Booking Cancelled</h2>
              <p>Dear ${booking.user.name},</p>
              <p>Your booking has been cancelled and a refund request has been initiated.</p>
              
              <div style="background: #ffe6e6; padding: 20px; margin: 20px 0; border-radius: 8px;">
                <h3>Cancellation Details:</h3>
                <p><strong>Hotel:</strong> ${booking.hotel.name}</p>
                <p><strong>Booking ID:</strong> ${bookingId}</p>
                <p><strong>Cancelled By:</strong> ${user.role === 'hotel' ? 'Hotel' : 'You'}</p>
                <p><strong>Reason:</strong> ${cancelReason}</p>
              </div>
              
              <div style="background: #e8f5e8; padding: 20px; margin: 20px 0; border-radius: 8px;">
                <h3>Refund Information:</h3>
                <p>A refund request has been created and will be processed according to our refund policy.</p>
                <p>You will receive updates on the refund status via email and notifications.</p>
              </div>
              
              <p>We apologize for any inconvenience caused.</p>
            `,
            source: 'booking_cancelled_refund',
            sourceId: bookingId
          });

        } catch (error) {
          console.error('Failed to send cancellation notifications:', error);
        }
      });

      return {
        message: 'Booking cancelled successfully. Refund request created.',
        refundInfo: refundResult,
        cancelledBy: user.role === 'hotel' ? 'hotel' : 'user'
      };
    } else {
      // No payment made, just cancel the booking
      await db.update(bookings)
        .set({
          status: 'cancelled',
          cancellationReason: cancelReason,
          cancelledBy: user.role === 'hotel' ? 'hotel' : 'user',
          cancelledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(bookings.id, bookingId));

      setImmediate(async () => {
        try {
          // Send immediate push notification
          await this.notificationService.sendInstantBookingSuccessNotification(booking.userId, {
            title: 'Booking Cancelled ❌',
            message: `Your booking at ${booking.hotel.name} has been cancelled.`,
            type: 'booking_cancelled',
            data: {
              bookingId,
              hotelName: booking.hotel.name,
              cancelReason,
              refundInitiated: false,
              cancelledBy: user.role === 'hotel' ? 'hotel' : 'user'
            }
          });

          // Send immediate email notification
          await this.notificationService.sendImmediateNotification({
            userId: booking.userId,
            type: 'email',
            title: 'Booking Cancelled - ' + booking.hotel.name,
            message: `
                <h2>❌ Booking Cancelled</h2>
                <p>Dear ${booking.user.name},</p>
                <p>Your booking has been cancelled.</p>
                
                <div style="background: #ffe6e6; padding: 20px; margin: 20px 0; border-radius: 8px;">
                  <h3>Cancellation Details:</h3>
                  <p><strong>Hotel:</strong> ${booking.hotel.name}</p>
                  <p><strong>Booking ID:</strong> ${bookingId}</p>
                  <p><strong>Cancelled By:</strong> ${user.role === 'hotel' ? 'Hotel' : 'You'}</p>
                  <p><strong>Reason:</strong> ${cancelReason}</p>
                </div>
                
                <p><strong>Note:</strong> No refund is required as payment was not completed.</p>
                <p>Thank you for your understanding.</p>
              `,
            source: 'booking_cancelled_no_refund',
            sourceId: bookingId
          });

        } catch (error) {
          console.error('Failed to send cancellation notifications:', error);
        }
      });

      return {
        message: 'Booking cancelled successfully. No refund required as payment was not completed.',
        refundInfo: null,
        cancelledBy: user.role === 'hotel' ? 'hotel' : 'user'
      };
    }
  }




  async updateBookingStatus(
    bookingId: string,
    status: string,
    updatedBy: string,
    reason?: string
  ) {
    const db = this.fastify.db;

    const now = new Date();
    const updateData: Partial<typeof bookings.$inferInsert> = {
      status,
      updatedAt: now,
    };

    if (status === 'cancelled') {
      (updateData as any).cancelReason = reason;
      (updateData as any).cancelledBy = updatedBy;
      (updateData as any).cancelledAt = now;
    }
    if (status === 'checked-in') {
      (updateData as any).checkedInAt = now;
      (updateData as any).paymentStatus = 'paid';
    }
    if (status === 'completed') {
      (updateData as any).completedAt = now;
    }

    // Keep the fetched booking from the tx to return later (optional)
    let updatedBooking: any = null;

    await db.transaction(async (tx) => {
      // Handle payment-side effects atomically with booking update
      if (status === 'checked-in') {
        const payment = await tx.query.payments.findFirst({
          where: eq(payments.bookingId, bookingId),
        });
        if (!payment) {
          throw new Error('Payment not registered for this booking. Do offline managing.');
        }

        await tx
          .update(payments)
          .set({
            status: 'completed',
            paymentMode: 'offline',
            updatedAt: now,
            paymentType: 'full',
          })
          .where(eq(payments.bookingId, bookingId));
      }

      await tx.update(bookings).set(updateData).where(eq(bookings.id, bookingId));

      // If you want the latest snapshot inside the tx:
      // (Adjust the `with` as per your relations)
      updatedBooking = await tx.query.bookings.findFirst({
        where: eq(bookings.id, bookingId),
        with: {
          hotel: true,
        },
      });
    }); // <- commits here if no throw

    // Send notification AFTER commit (so users never see a status that later rolls back)
    if (updatedBooking) {
      try {
        setImmediate(async () => {
          try {
            let notificationMessage = '';
            let emailTitle = '';
            let emailContent = '';

            switch (status) {
              case 'confirmed':
                notificationMessage = `Your booking at ${updatedBooking.hotel.name} has been confirmed`;
                emailTitle = 'Booking Confirmed - ' + updatedBooking.hotel.name;
                emailContent = `
                  <h2>✅ Booking Confirmed!</h2>
                  <p>Great news! Your booking has been confirmed.</p>
                  <div style="background: #e8f5e8; padding: 20px; margin: 20px 0; border-radius: 8px;">
                    <h3>Booking Details:</h3>
                    <p><strong>Hotel:</strong> ${updatedBooking.hotel.name}</p>
                    <p><strong>Booking ID:</strong> ${bookingId}</p>
                    <p><strong>Status:</strong> Confirmed ✅</p>
                  </div>
                  <p>We look forward to welcoming you!</p>
                `;
                break;
              case 'cancelled':
                notificationMessage = `Your booking at ${updatedBooking.hotel.name} has been cancelled. Reason: ${reason ?? 'N/A'}`;
                emailTitle = 'Booking Cancelled - ' + updatedBooking.hotel.name;
                emailContent = `
                  <h2>❌ Booking Cancelled</h2>
                  <p>Your booking has been cancelled.</p>
                  <div style="background: #ffe6e6; padding: 20px; margin: 20px 0; border-radius: 8px;">
                    <h3>Cancellation Details:</h3>
                    <p><strong>Hotel:</strong> ${updatedBooking.hotel.name}</p>
                    <p><strong>Booking ID:</strong> ${bookingId}</p>
                    <p><strong>Reason:</strong> ${reason ?? 'N/A'}</p>
                    <p><strong>Status:</strong> Cancelled ❌</p>
                  </div>
                  <p>If you have any questions, please contact our support team.</p>
                `;
                break;
              case 'checked-in':
                notificationMessage = `You have been checked in at ${updatedBooking.hotel.name}`;
                emailTitle = 'Check-in Successful - ' + updatedBooking.hotel.name;
                emailContent = `
                  <h2>🏨 Check-in Successful!</h2>
                  <p>Welcome! You have been successfully checked in.</p>
                  <div style="background: #e8f5e8; padding: 20px; margin: 20px 0; border-radius: 8px;">
                    <h3>Check-in Details:</h3>
                    <p><strong>Hotel:</strong> ${updatedBooking.hotel.name}</p>
                    <p><strong>Booking ID:</strong> ${bookingId}</p>
                    <p><strong>Status:</strong> Checked In 🏨</p>
                  </div>
                  <p>Enjoy your stay with us!</p>
                `;
                break;
              case 'completed':
                notificationMessage = `Your stay at ${updatedBooking.hotel.name} has been completed. Thank you for choosing us!`;
                emailTitle = 'Stay Completed - ' + updatedBooking.hotel.name;
                emailContent = `
                  <h2>🎉 Stay Completed!</h2>
                  <p>Thank you for staying with us! We hope you had a wonderful experience.</p>
                  <div style="background: #f0f8ff; padding: 20px; margin: 20px 0; border-radius: 8px;">
                    <h3>Completion Details:</h3>
                    <p><strong>Hotel:</strong> ${updatedBooking.hotel.name}</p>
                    <p><strong>Booking ID:</strong> ${bookingId}</p>
                    <p><strong>Status:</strong> Completed 🎉</p>
                  </div>
                  <p>We'd love to hear about your experience. Please consider leaving a review!</p>
                `;
                break;
              default:
                notificationMessage = `Your booking status has been updated to ${status}`;
                emailTitle = 'Booking Status Update - ' + updatedBooking.hotel.name;
                emailContent = `
                  <h2>📋 Booking Status Updated</h2>
                  <p>Your booking status has been updated.</p>
                  <div style="background: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 8px;">
                    <p><strong>Hotel:</strong> ${updatedBooking.hotel.name}</p>
                    <p><strong>Booking ID:</strong> ${bookingId}</p>
                    <p><strong>New Status:</strong> ${status}</p>
                  </div>
                `;
            }

            // Send immediate push notification
            await this.notificationService.sendInstantBookingSuccessNotification(updatedBooking.userId, {
              title: 'Booking Status Updated',
              message: notificationMessage,
              type: 'booking_status_update',
              data: {
                bookingId,
                status,
                hotelName: updatedBooking.hotel.name,
              },
            });

            // Send immediate email notification
            await this.notificationService.sendImmediateNotification({
              userId: updatedBooking.userId,
              type: 'email',
              title: emailTitle,
              message: emailContent,
              source: 'booking_status_update',
              sourceId: bookingId
            });

          } catch (err) {
            this.fastify.log.error('Failed to send booking status update notifications:', err);
            // Fallback to queue
            await this.notificationService.queueNotification({
              userId: updatedBooking.userId,
              type: 'push',
              priority: 1,
              title: 'Booking Status Updated',
              message: `Your booking status has been updated to ${status}`,
              data: {
                bookingId,
                status,
                hotelName: updatedBooking.hotel.name
              },
              source: 'booking_status_update_fallback'
            });
          }
        });

      } catch (err) {
        this.fastify.log.error('Failed to send booking status update notification:', err);
        // no rethrow — status is already committed
      }
    }

    return updatedBooking ?? (await this.getBookingById(bookingId));
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
      try {
        await this.notificationService.sendInstantBookingSuccessNotification(booking.userId, {
          title: 'Guest Details Updated',
          message: `Guest details for your booking at ${booking.hotel.name} have been updated`,
          type: 'guest_details_update',
          data: {
            bookingId,
            hotelName: booking.hotel.name,
          }
        });
      } catch (error) {
        this.fastify.log.error('Failed to send guest details update notification:', error);
      }

      // Send email notification for guest details update
      try {
        await this.notificationService.sendImmediateNotification({
          userId: booking.userId,
          type: 'email',
          title: "Guest Details Updated",
          message: `
            <h2>Guest Details Updated</h2>
            <p>Dear Guest,</p>
            <p>Your guest details for booking <strong>${bookingId}</strong> at <strong>${booking.hotel.name}</strong> have been updated.</p>
            <p>Updated Details:</p>
            <ul>
              <li><strong>Name:</strong> ${guestDetails.guestName}</li>
              <li><strong>Email:</strong> ${guestDetails.guestEmail}</li>
              <li><strong>Phone:</strong> ${guestDetails.guestPhone}</li>
            </ul>
            <p>If you did not make this change, please contact us immediately.</p>
            <p>Thank you for choosing ${booking.hotel.name}!</p>
          `,
          email: guestDetails.guestEmail
        });
      } catch (error) {
        this.fastify.log.error('Failed to send guest details update email:', error);
      }
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
        hotel: true
      }
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

    // Get platform fee configuration
    const platformFeeConfig = await this.fastify.db.query.configurations.findFirst({
      where: eq(configurations.key, 'platform_fee')
    });
    const platformFeePercentage = platformFeeConfig ? parseFloat(platformFeeConfig.value) : 5;

    // Calculate fees
    const gstAmount = basePrice * (room.hotel.gstPercentage / 100);
    const platformFee = basePrice * (platformFeePercentage / 100);
    const totalAmount = basePrice + gstAmount + platformFee;

    return {
      roomId: room.id,
      roomName: room.name,
      bookingType,
      ...priceDetails,
      basePrice,
      gstAmount,
      platformFee,
      totalAmount,
      currency: 'INR',
      checkInDate,
      checkOutDate,
      guestCount,
      hotelName: room.hotel.name,
      available: true,
      gstPercentage: room.hotel.gstPercentage,
      platformFeePercentage
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
  async getBookingDetails(bookingId: string, user: any) {
    const db = this.fastify.db;

    const booking = await db.query.bookings.findFirst({
      where: eq(bookings.id, bookingId),
      with: {
        user: true,
        hotel: {
          with: {
            images: true,
            // amenities: true // Assuming amenities are stored as JSON in the hotel table
          }
        },
        room: {
          with: {
            roomType: true,
            images: true
          }
        },
        payment: true
      }
    });

    if (!booking) {
      return null;
    }

    // console.log('booking is ', booking)
    // console.log('user is ', user)

    // Check if user is authorized to view this booking
    if (booking.userId !== user.id && booking.hotel.ownerId !== user.id && user.role !== UserRole.SUPER_ADMIN) {
      throw new Error('Unauthorized. You do not have permission to view this booking');
    }

    // Get review information if exists
    const reviewData = await db.query.hotelReviews.findFirst({
      where: eq(hotelReviews.bookingId, bookingId),
      with: {
        user: true // Include user data for review
      }
    });

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
    // console.log('booking.checkInDate ', booking.checkInDate)
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

    // Get platform fee configuration
    const platformFeeConfig = await this.fastify.db.query.configurations.findFirst({
      where: eq(configurations.key, 'platform_fee')
    });
    const platformFeePercentage = platformFeeConfig ? parseFloat(platformFeeConfig.value) : 5;

    // Calculate fees
    const gstAmount = subtotal * (booking.hotel.gstPercentage / 100);
    const platformFee = subtotal * (platformFeePercentage / 100);
    const totalCalculated = subtotal + gstAmount + platformFee;

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

    // console.log('booking ', booking)

    // console.log('booking.hotel.amenities ', booking.hotel.amenities)

    // Get amenities (assuming these are stored in room type or hotel)
    const amenities = JSON.parse(booking.hotel.amenities) || []

    // Get booking addons
    const bookingAddons = await this.addonService.getBookingAddons(booking.id);

    // console.log('checkin date ', checkInDate)
    // console.log('checkout ', checkOutDate)

    const globalOnlinePayment = await this.fastify.db.query.configurations.findFirst({
      where: eq(configurations.key, 'online_payment_global_enabled')
    })

    const defaultCanceellationHours = await this.fastify.db.query.configurations.findFirst({
      where: eq(configurations.key, 'default_cancellation_hours')
    })

    const coupounUsagesFoBooking = await this.fastify.db.query.couponUsages.findFirst({
      where: eq(couponUsages.bookingId, booking.id)
    })




    return {
      id: booking.id,
      bookingReference: `REF${booking.id.slice(-9).toUpperCase()}`,
      status,
      bookingType: booking.bookingType,
      hotelName: booking.hotel.name,
      hotelPhone: booking.hotel.contactNumber || '+91 9876543210',
      hotelEmail: booking.hotel.contactEmail || 'info@hotel.com',
      address: `${booking.hotel.address}, ${booking.hotel.city}, ${booking.hotel.state}`,
      images: booking.room.images.map(image => image.url) || 'https://example.com/hotel.jpg',
      roomType: booking.room.roomType?.name || booking.room.name,
      checkIn: checkInDate,
      checkOut: checkOutDate,
      guests: booking.guestCount,
      onlinePaymentEnabled: globalOnlinePayment ? globalOnlinePayment.value === 'true' ? true : false : booking.hotel.onlinePaymentEnabled,
      cancellationHours: defaultCanceellationHours ? defaultCanceellationHours.value : 24,
      guestName: booking.guestName,
      guestEmail: booking.guestEmail,
      guestPhone: booking.guestPhone,
      nights,
      paymentStaus: booking.payment.status,
      paymentAmount: booking.payment.amount,
      amenities,
      latitude: booking.hotel.mapCoordinates.split(",")[0],
      longitude: booking.hotel.mapCoordinates.split(",")[1],
      priceBreakdown: {
        roomRate,
        subtotal,
        gstAmount,
        platformFee,
        gstPercentage: booking.hotel.gstPercentage,
        platformFeePercentage,
        couponAppliedAmount: coupounUsagesFoBooking ? coupounUsagesFoBooking.discountAmount : 0,
        walletAmount: booking.walletAmountUsed

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
      })),
      reviewData: reviewData ? {
        id: reviewData.id,
        rating: reviewData.rating,
        comment: reviewData.comment,
        isVerified: reviewData.isVerified,
        createdAt: reviewData.createdAt,
        userName: reviewData.user?.name || 'Anonymous'
      } : null
    };
  }

  async getGstCalculated(hotelId, amount) {

    const hotel = await this.fastify.db.query.hotels.findFirst({
      where: eq(hotels.id, hotelId)


    })
    if (!hotel) {
      return 0;
    }

    return amount * (hotel.gstPercentage / 100)
  }
}