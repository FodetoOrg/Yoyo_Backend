import { FastifyInstance } from 'fastify';
import { bookings, payments, rooms } from '../models/schema';
import { eq, and, not, between, or } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
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
  private razorpay: Razorpay;

  constructor() {
    // Initialize Razorpay
    this.razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID || '',
      key_secret: process.env.RAZORPAY_KEY_SECRET || ''
    });
  }

  // Method to set Fastify instance
  setFastify(fastify: FastifyInstance) {
    this.fastify = fastify;
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
        or(
          // New booking starts during existing booking
          and(
            sql`datetime(${bookings.checkInDate}) <= datetime(${checkInDate.toISOString()})`,
            sql`datetime(${bookings.checkOutDate}) > datetime(${checkInDate.toISOString()})`
          ),
          // New booking ends during existing booking
          and(
            sql`datetime(${bookings.checkInDate}) < datetime(${checkOutDate.toISOString()})`,
            sql`datetime(${bookings.checkOutDate}) >= datetime(${checkOutDate.toISOString()})`
          ),
          // New booking completely encompasses existing booking
          and(
            sql`datetime(${checkInDate.toISOString()}) <= datetime(${bookings.checkInDate})`,
            sql`datetime(${checkOutDate.toISOString()}) >= datetime(${bookings.checkOutDate})`
          ),
          // Existing booking completely encompasses new booking
          and(
            sql`datetime(${bookings.checkInDate}) <= datetime(${checkInDate.toISOString()})`,
            sql`datetime(${bookings.checkOutDate}) >= datetime(${checkOutDate.toISOString()})`
          )
        )
      )
    });

    if (overlappingBookings.length > 0) {
      return { available: false, reason: 'Room is already booked for the selected dates' };
    }

    return { available: true, reason: null };
  }

  // Create a new booking
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
  }) {
    const db = this.fastify.db;
    const bookingId = uuidv4();

    return await db.transaction(async (tx) => {
      // Get hotel and room details
      const hotel = await tx.query.hotels.findFirst({
        where: eq(hotels.id, bookingData.hotelId)
      });

      if (!hotel) {
        throw new Error('Hotel not found');
      }

      const room = await tx.query.rooms.findFirst({
        where: eq(rooms.id, bookingData.roomId)
      });

      if (!room) {
        throw new Error('Room not found');
      }

      // Calculate expected price
      const nights = Math.ceil((bookingData.checkOut.getTime() - bookingData.checkIn.getTime()) / (1000 * 60 * 60 * 24));
      const expectedPrice = room.pricePerNight * nights;

      // Validate price from frontend matches calculated price
      if (Math.abs(bookingData.frontendPrice - expectedPrice) > 0.01) {
        throw new Error(`Price mismatch: Expected ${expectedPrice}, received ${bookingData.frontendPrice}`);
      }

      // Determine payment mode based on hotel configuration and user preference
      let finalPaymentMode = bookingData.paymentMode || 'offline';
      let requiresOnlinePayment = false;
      let paymentDueDate = null;
      let remainingAmount = bookingData.totalAmount;
      let advanceAmount = 0;

      // Validate payment mode against hotel configuration
      if (finalPaymentMode === 'online' && !hotel.onlinePaymentEnabled) {
        throw new Error('Online payment is not enabled for this hotel');
      }

      if (finalPaymentMode === 'offline' && !hotel.offlinePaymentEnabled) {
        throw new Error('Offline payment is not enabled for this hotel');
      }

      // Set payment requirements based on mode
      if (finalPaymentMode === 'online') {
        requiresOnlinePayment = true;
      } else {
        // For offline payments, set due date (e.g., 24 hours before check-in)
        paymentDueDate = new Date(bookingData.checkInDate);
        paymentDueDate.setHours(paymentDueDate.getHours() - 24);

        // Handle advance payment if specified
        if (bookingData.advanceAmount && bookingData.advanceAmount > 0) {
          advanceAmount = Math.min(bookingData.advanceAmount, bookingData.totalAmount);
          remainingAmount = bookingData.totalAmount - advanceAmount;
        }
      }

      // Create booking
      await tx.insert(bookings).values({
        id: bookingId,
        userId: bookingData.userId,
        hotelId: bookingData.hotelId,
        roomId: bookingData.roomId,
        checkInDate: bookingData.checkIn,
        checkOutDate: bookingData.checkOut,
        bookingType: 'daily', // Assuming default booking type is daily
        totalHours: 24, // Assuming default total hours is 24
        guestCount: bookingData.guests,
        totalAmount: bookingData.totalAmount,
        paymentMode: finalPaymentMode,
        requiresOnlinePayment,
        paymentDueDate,
        advanceAmount,
        remainingAmount,
        specialRequests: bookingData.specialRequests,
        status: finalPaymentMode === 'offline' ? 'confirmed' : 'pending',
        paymentStatus: finalPaymentMode === 'offline' ? 'pending' : 'pending',
      });

      // Create payment record
      const paymentId = uuidv4();
      await tx.insert(payments).values({
        id: paymentId,
        bookingId,
        userId: bookingData.userId,
        amount: finalPaymentMode === 'offline' && advanceAmount > 0 ? advanceAmount : bookingData.totalAmount,
        currency: 'INR',
        paymentType: finalPaymentMode === 'offline' && advanceAmount > 0 ? 'advance' : 'full',
        paymentMethod: finalPaymentMode === 'offline' ? (hotel.defaultPaymentMethod || 'cash') : 'razorpay',
        paymentMode: finalPaymentMode,
        status: 'pending',
        transactionDate: new Date(),
      });

      // If there's remaining amount for offline payment, create another payment record
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

      // Get the created booking
      const booking = await this.getBookingById(bookingId);
      return booking;
    });
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
  async getBookingsByUserId(userId: string) {
    const db = this.fastify.db;

    const userBookings = await db.query.bookings.findMany({
      where: eq(bookings.userId, userId),
      with: {
        hotel: true,
        room: true
      },
      orderBy: (bookings, { desc }) => [desc(bookings.createdAt)]
    });

    // Format bookings
    return userBookings.map(booking => ({
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
  }

  // Get bookings by hotel ID
  async getBookingsByHotelId(hotelId: string) {
    const db = this.fastify.db;

    const hotelBookings = await db.query.bookings.findMany({
      where: eq(bookings.hotelId, hotelId),
      with: {
        user: true,
        room: true
      },
      orderBy: (bookings, { desc }) => [desc(bookings.createdAt)]
    });

    // Format bookings
    return hotelBookings.map(booking => ({
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
}