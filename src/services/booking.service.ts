// @ts-nocheck
import { FastifyInstance } from 'fastify';
import { bookings, hotels, rooms, users, customerProfiles, coupons, payments, bookingCoupons } from '../models/schema';
import { eq, and, desc, asc, count, not, lt, gt, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { NotFoundError, ConflictError } from '../types/errors';
import { CouponService } from './coupon.service';
import { NotificationService } from './notification.service';
import Razorpay from 'razorpay';
import { generateBookingConfirmationEmail } from '../utils/email';
import { AddonService } from './addon.service';

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

  constructor() {
    this.couponService = new CouponService();
    this.notificationService = new NotificationService();
    this.addonService = new AddonService();
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

    // Check guest capacity
    if (room.capacity < guestCount) {
      return { available: false, reason: `Room capacity (${room.capacity}) is less than requested guests (${guestCount})` };
    }

    // Check if there are any overlapping bookings
    const overlappingBookings = await db.query.bookings.findMany({
      where: and(
        eq(bookings.roomId, roomId),
        not(eq(bookings.status, 'cancelled')),
        // Check for any date overlap: booking conflicts if checkIn < existing.checkOut AND checkOut > existing.checkIn
        lt(bookings.checkInDate, checkOutDate), // existing booking starts before new booking ends
        gt(bookings.checkOutDate, checkInDate)
      )
    });

    if (overlappingBookings.length > 0) {
      return { available: false, reason: 'Room is already booked for the selected dates' };
    }

    return { available: true, reason: null };
  }
  // Optimized createBooking method
  async createBooking(bookingData: {
    hotelId: string;
    roomId: string;
    userId: string;
    checkIn: Date;
    checkOut: Date;
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
      const nights = Math.ceil((bookingData.checkOut.getTime() - bookingData.checkIn.getTime()) / (1000 * 60 * 60 * 24));

      // Payment calculations
      let requiresOnlinePayment = finalPaymentMode === 'online';
      let paymentDueDate = null;
      let remainingAmount = finalAmount;
      let advanceAmount = 0;

      if (finalPaymentMode === 'offline') {
        paymentDueDate = new Date(bookingData.checkIn);
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
        bookingType: 'daily',
        totalHours: 24,
        guestCount: bookingData.guests,
        totalAmount: finalAmount,
        paymentMode: finalPaymentMode,
        requiresOnlinePayment,
        paymentDueDate,
        advanceAmount,
        remainingAmount,
        specialRequests: bookingData.specialRequests,
        status: finalPaymentMode === 'offline' ? 'confirmed' : 'pending',
        paymentStatus: 'pending',
        guestEmail: bookingData.guestEmail,
        guestName: bookingData.guestName,
        guestPhone: bookingData.guestPhone
      });

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
      }

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
        paymentMode: finalPaymentMode,
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
        await this.addonService.addBookingAddons(bookingId, bookingData.addons);
      }

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

    // Price validation
    const nights = Math.ceil((bookingData.checkOut.getTime() - bookingData.checkIn.getTime()) / (1000 * 60 * 60 * 24));
    const expectedPrice = room.pricePerNight * nights;

    // Coupon validation
    let couponValidation = null;
    let finalAmount = bookingData.totalAmount;

    if (bookingData.couponCode) {
      try {
        couponValidation = await this.couponService.validateCoupon(
          bookingData.couponCode,
          bookingData.hotelId,
          room.roomType,
          bookingData.totalAmount
        );

        if (couponValidation) {
          finalAmount = couponValidation.finalAmount;

          // Validate price with coupon
          if (Math.abs(bookingData.frontendPrice - couponValidation.finalAmount) > 0.01) {
            throw new ConflictError(`Price mismatch: Expected ${couponValidation.finalAmount}, received ${bookingData.frontendPrice}`);
          }
        }
      } catch (error) {
        throw new NotFoundError('Coupon Not Found');
      }
    } else {
      // Validate price without coupon
      if (Math.abs(bookingData.frontendPrice - expectedPrice) > 0.01) {
        throw new ConflictError(`Price mismatch: Expected ${expectedPrice}, received ${bookingData.frontendPrice}`);
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
      payment: booking.payment.map(p => ({
        id: p.id,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        paymentMethod: p.paymentMethod,
        transactionDate: p.transactionDate
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

    // Format bookings
    const formattedBookings = userBookings.map(booking => ({
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
    }));

    return {
      bookings: formattedBookings,
      total,
      page,
      limit
    };
  }

  // Get bookings by hotel ID
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

    // Format bookings
    const formattedBookings = hotelBookings.map(booking => {
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
    });

    return {
      bookings: formattedBookings,
      total,
      page,
      limit
    };
  }

  // Get all bookings (admin only)
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

    // Format bookings
    const formattedBookings = allBookings.map(booking => {
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
    });

    return {
      bookings: formattedBookings,
      total,
      page,
      limit
    };
  }

  // Cancel a booking
  async cancelBooking(bookingId: string) {
    const db = this.fastify.db;

    await db
      .update(bookings)
      .set({
        status: 'cancelled',
        updatedAt: new Date()
      })
      .where(eq(bookings.id, bookingId));

    // Get the updated booking
    const booking = await this.getBookingById(bookingId);
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
  async getCheckoutPriceDetails(roomId: string, checkInDate: Date, checkOutDate: Date, guestCount: number) {
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

    // Calculate pricing
    const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
    const basePrice = room.pricePerNight * nights;

    // You can add additional charges, taxes, etc. here
    const taxes = basePrice * 0.12; // 12% GST
    const totalAmount = basePrice + taxes;

    return {
      roomId: room.id,
      roomName: room.name,
      pricePerNight: room.pricePerNight,
      nights,
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
        }
      }
    });

    if (!booking) {
      return null;
    }

    // Check if user is authorized to view this booking
    if (booking.userId !== userId) {
      throw new Error('Unauthorized. You do not have permission to view this booking');
    }

    // Calculate nights
    const checkInDate = new Date(booking.checkInDate);
    const checkOutDate = new Date(booking.checkOutDate);
    const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));

    // Calculate price breakdown
    const roomRate = booking.room.pricePerNight;
    const subtotal = roomRate * nights;
    const taxes = Math.round(subtotal * 0.12); // 12% GST
    const serviceFee = 100; // Fixed service fee
    const totalCalculated = subtotal + taxes + serviceFee;

    // Determine status based on dates and booking status
    let status = booking.status;
    const now = new Date();
    if (booking.status === 'confirmed') {
      if (now < checkInDate) {
        status = 'upcoming';
      } else if (now > checkOutDate) {
        status = 'completed';
      } else {
        status = 'confirmed';
      }
    }

    console.log('booking.hotel.amenities ', booking.hotel.amenities)

    // Get amenities (assuming these are stored in room type or hotel)
    const amenities = JSON.parse(booking.hotel.amenities) || []


    return {
      id: booking.id,
      bookingReference: `REF${booking.id.slice(-9).toUpperCase()}`,
      status,
      hotelName: booking.hotel.name,
      hotelPhone: booking.hotel.contactNumber || '+91 9876543210',
      hotelEmail: booking.hotel.contactEmail || 'info@hotel.com',
      address: `${booking.hotel.address}, ${booking.hotel.city}, ${booking.hotel.state}`,
      image: booking.hotel.images?.[0]?.url || 'https://example.com/hotel.jpg',
      roomType: booking.room.roomType?.name || booking.room.name,
      checkIn: checkInDate.toISOString(),
      checkOut: checkOutDate.toISOString(),
      guests: booking.guestCount,
      nights,
      amenities,
      priceBreakdown: {
        roomRate,
        subtotal,
        taxes,
        serviceFee
      },
      totalAmount: booking.totalAmount,
      cancellationPolicy: booking.hotel.cancellationPolicy || 'Free cancellation up to 24 hours before check-in. After that, a 1-night charge will apply.'
    };
  }
}