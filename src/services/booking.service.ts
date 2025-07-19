import { FastifyInstance } from 'fastify';
import { bookings, hotels, rooms, users, customerProfiles, coupons, payments } from '../models/schema';
import { eq, and, desc, asc, count, not, lt, gt } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { NotFoundError, ConflictError } from '../types/errors';
import { CouponService } from './coupon.service';
import { NotificationService } from './notification.service';
import Razorpay from 'razorpay';

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

  constructor() {
    this.couponService = new CouponService();
    this.notificationService = new NotificationService();
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

  async createBooking(bookingData: {
    hotelId: string;
    roomId: string;
    userId: string;
    guestName: string;
    guestEmail: string;
    guestPhone: string;
    checkIn: Date;
    checkOut: Date;
    guests: number;
    totalAmount: number;
    frontendPrice: number;
    specialRequests?: string;
    paymentMode?: string;
    advanceAmount?: number;
    couponCode?: string;
  }) {
    const db = this.fastify.db;

    try {
      const bookingId = uuidv4();

      // Apply coupon if provided
      let discountAmount = 0;
      let finalAmount = bookingData.totalAmount;

      if (bookingData.couponCode) {
        const coupon = await db.query.coupons.findFirst({
          where: eq(coupons.code, bookingData.couponCode)
        });

        if (coupon && coupon.isActive) {
          if (coupon.discountType === 'percentage') {
            discountAmount = (bookingData.totalAmount * coupon.discountValue) / 100;
          } else {
            discountAmount = coupon.discountValue;
          }
          finalAmount = bookingData.totalAmount - discountAmount;
        }
      }
        const paymentDueDate = new Date(bookingData.checkIn);
        paymentDueDate.setDate(paymentDueDate.getDate() - 1);

        const finalPaymentMode = bookingData.paymentMode || 'offline';
        const requiresOnlinePayment = finalPaymentMode === 'online';
        const advanceAmount = bookingData.advanceAmount || 0;
        const remainingAmount = finalAmount - advanceAmount;

      // Create booking
      await db.insert(bookings).values({
        id: bookingId,
        userId: bookingData.userId,
        hotelId: bookingData.hotelId,
        roomId: bookingData.roomId,
        guestName: bookingData.guestName,
        guestEmail: bookingData.guestEmail,
        guestPhone: bookingData.guestPhone,
        checkInDate: bookingData.checkIn,
        checkOutDate: bookingData.checkOut,
        bookingType: 'daily', // Assuming default booking type is daily
        totalHours: 24, // Assuming default total hours is 24
        guestCount: bookingData.guests,
        totalAmount: finalAmount,
        paymentMode: finalPaymentMode,
        requiresOnlinePayment,
        paymentDueDate,
        advanceAmount,
        remainingAmount,
        specialRequests: bookingData.specialRequests,
        status: finalPaymentMode === 'offline' ? 'confirmed' : 'pending',
        paymentStatus: finalPaymentMode === 'offline' ? 'pending' : 'pending'
      });

      // Create coupon mapping if coupon was applied
      if (bookingData.couponCode && discountAmount > 0) {
        const coupon = await db.query.coupons.findFirst({
          where: eq(coupons.code, bookingData.couponCode)
        });

        if(coupon){
          const bookingCouponId = uuidv4();
          await db.insert(payments).values({
            id: bookingCouponId,
            bookingId: bookingId,
            userId: bookingData.userId,
            amount: discountAmount,
            currency: 'INR', // Assuming currency is INR
            status: 'completed', // Assuming coupon discount is completed
            paymentMethod: 'coupon', // Assuming payment method is coupon
          });
        }
      }

      // Get booking with relations for notifications
      const bookingWithRelations = await db.query.bookings.findFirst({
        where: eq(bookings.id, bookingId),
        with: {
          hotel: true,
          room: true,
          user: true,
        }
      });

      // Send instant notifications
      if (bookingWithRelations) {
        // Send to guest
        await this.fastify.notificationService.sendNotificationFromTemplate(
          'booking_confirmed_offline',
          bookingData.userId,
          {
            guestName: bookingData.guestName,
            hotelName: bookingWithRelations.hotel.name,
            checkIn: bookingWithRelations.checkInDate,
            checkOut: bookingWithRelations.checkOutDate,
            totalAmount: finalAmount,
            bookingId: bookingId,
            paymentDueDate: bookingWithRelations.checkInDate,
          }
        );

        // Send to hotel admin
        await this.fastify.notificationService.sendNotificationFromTemplate(
          'new_booking_hotel',
          bookingWithRelations.hotel.ownerId,
          {
            guestName: bookingData.guestName,
            amount: finalAmount,
            checkIn: bookingWithRelations.checkInDate,
            bookingId: bookingId,
          }
        );
      }

      return { bookingId };
    } catch (error) {
      throw new Error(`Failed to create booking: ${error.message}`);
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
      }
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

    // Format bookings
    const formattedBookings = hotelBookings.map(booking => ({
      id: booking.id,
      checkInDate: booking.checkInDate,
      checkOutDate: booking.checkOutDate,
      bookingType: booking.bookingType,
      guestCount: booking.guestCount,
      totalAmount: booking.totalAmount,
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
      }
    }));

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

    // Format bookings
    const formattedBookings = allBookings.map(booking => ({
      id: booking.id,
      checkInDate: booking.checkInDate,
      checkOutDate: booking.checkOutDate,
      bookingType: booking.bookingType,
      guestCount: booking.guestCount,
      totalAmount: booking.totalAmount,
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
      }
    }));

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

    console.log('booking.hotel.amenities ',booking.hotel.amenities)

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