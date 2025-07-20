// @ts-nocheck
import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { BookingService } from '../services/booking.service';
import { HotelService } from '../services/hotel.service';

// Import validation schemas from schema file
import {
  CreateBookingBodySchema,
  GetBookingParamsSchema,
  GetUserBookingsQuerySchema,
  GetHotelBookingsParamsSchema,
  CancelBookingParamsSchema
} from '../schemas/booking.schema';
import { UserRole } from '../types/common';



export class BookingController {
  private bookingService: BookingService;
  private hotelService: HotelService;

  constructor() {
    this.bookingService = new BookingService();
    this.hotelService = new HotelService();
  }

  // Create a new booking
  async createBooking(request: FastifyRequest, reply: FastifyReply) {
    try {
      const bookingData = CreateBookingBodySchema.parse(request.body);
      const userId = request.user.id as string;

      // Check if room exists and is available
      const room = await this.hotelService.getRoomById(bookingData.roomId);

      if (!room) {
        return reply.code(404).send({
          success: false,
          message: 'Room not found',
        });
      }


      // Validate room belongs to the specified hotel
      if (room.hotelId !== bookingData.hotelId) {
        return reply.code(400).send({
          success: false,
          message: 'Room does not belong to the specified hotel',
        });
      }

      // Check if the room is available for the requested dates and guest count
      const availabilityCheck = await this.bookingService.checkRoomAvailability(
        bookingData.roomId,
        new Date(bookingData.checkIn),
        new Date(bookingData.checkOut),
        bookingData.guests
      );

      if (!availabilityCheck.available) {
        return reply.code(400).send({
          success: false,
          message: availabilityCheck.reason || 'Room is not available',
        });
      }

      // Calculate total amount based on daily booking
      const checkInDate = new Date(bookingData.checkIn);
      const checkOutDate = new Date(bookingData.checkOut);
      const diffTime = Math.abs(checkOutDate.getTime() - checkInDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      const totalAmount = room.pricePerNight * diffDays;

      // Create booking
      const booking = await this.bookingService.createBooking({
        hotelId: bookingData.hotelId,
        roomId: bookingData.roomId,
        userId,
        checkIn: checkInDate,
        checkOut: checkOutDate,
        guests: bookingData.guests,
        totalAmount,
        frontendPrice: bookingData.totalAmount, // Pass frontend price for validation
        specialRequests: bookingData.specialRequests,
        paymentMode: bookingData.paymentMode,
        advanceAmount: bookingData.advanceAmount,
        guestEmail:bookingData.guestEmail,
        guestName:bookingData.guestName,
        guestPhone:bookingData.guestPhone,
        couponCode:bookingData.couponCode
      });

      console.log('booking final  is ',booking)
      return reply.code(201).send({
        success: true,
        message: 'Booking created successfully',
        data: {
          booking:{
            ...booking,
            checkIn:booking?.checkInDate,
            checkOut:booking?.checkOutDate,
            guests: booking?.guestCount,


          },
          paymentInfo: {
            totalAmount,
            currency: 'INR',
            paymentMode: booking?.paymentMode,
            requiresOnlinePayment: booking?.requiresOnlinePayment,
            advanceAmount: booking?.advanceAmount,
            remainingAmount: booking?.remainingAmount,
            paymentDueDate: booking?.paymentDueDate
          }
        }
      });
    } catch (error) {
      request.log.error(error);

      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
      }

      return reply.code(500).send({
        success: false,
        message: error.message || 'Failed to create booking',
      });
    }
  }

  // Get booking by ID
  async getBookingById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = GetBookingParamsSchema.parse(request.params);
      const userId = request.user.id as string;
      const role = request.user.role as string;

      const booking = await this.bookingService.getBookingById(id);

      if (!booking) {
        return reply.code(404).send({
          success: false,
          message: 'Booking not found',
        });
      }

      // Check if the user is authorized to view this booking
      // Only the user who created the booking, hotel owner, or admin can view it
      const hotel = await this.hotelService.getHotelById(booking.hotelId);

      if (booking.userId !== userId && hotel?.ownerId !== userId && role !== 'admin') {
        return reply.code(403).send({
          success: false,
          message: 'Unauthorized. You do not have permission to view this booking',
        });
      }

      return reply.code(200).send({
        success: true,
        message: 'Booking fetched successfully',
        data: {
          booking
        }
      });
    } catch (error) {
      request.log.error(error);

      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
      }

      return reply.code(500).send({
        success: false,
        message: error.message || 'Failed to fetch booking',
      });
    }
  }

  // Get detailed booking information for user
  async getBookingDetails(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = GetBookingParamsSchema.parse(request.params);
      const userId = request.user.id as string;

      const bookingDetails = await this.bookingService.getBookingDetails(id, userId);

      if (!bookingDetails) {
        return reply.code(404).send({
          success: false,
          message: 'Booking not found',
        });
      }

      return reply.code(200).send({
        success: true,
        data: {
          booking: bookingDetails
        }
      });
    } catch (error) {
      request.log.error(error);

      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
      }

      return reply.code(500).send({
        success: false,
        message: error.message || 'Failed to fetch booking details',
      });
    }
  }

  // Get user's bookings
  async getUserBookings(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = request.user.id;
      const { status, page = 1, limit = 10 } = request.query as any;

      const result = await this.bookingService.getBookingsByUserId(userId, { status, page, limit });

      return reply.code(200).send({
        success: true,
        message: 'User bookings fetched successfully',
        data: {
          bookings: result.bookings,
          total: result.total,
          page: result.page,
          limit: result.limit
        }
      });
    } catch (error) {
      request.log.error(error);

      return reply.code(500).send({
        success: false,
        message: error.message || 'Failed to fetch user bookings',
      });
    }
  }

  // Get all bookings (admin)
  async getAllBookings(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { status, page = 1, limit = 10 } = request.query as any;
      const role = request.user.role;

      console.log('user is ', request.user)
      // Only admin can access all bookings
      if (role !== UserRole.SUPER_ADMIN) {
        return reply.code(403).send({
          success: false,
          message: 'Unauthorized. Only admin can view all bookings',
        });
      }

      const result = await this.bookingService.getAllBookings({ status, page, limit });

      return reply.code(200).send({
        success: true,
        message: 'All bookings fetched successfully',
        data: {
          bookings: result.bookings,
          total: result.total,
          page: result.page,
          limit: result.limit
        }
      });
    } catch (error) {
      request.log.error(error);

      return reply.code(500).send({
        success: false,
        message: error.message || 'Failed to fetch all bookings',
      });
    }
  }

  // Get checkout price details
  async getCheckoutPriceDetails(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { roomId, checkIn, checkOut, guests } = request.query as any;

      if (!roomId || !checkIn || !checkOut || !guests) {
        return reply.code(400).send({
          success: false,
          message: 'Missing required parameters: roomId, checkIn, checkOut, guests',
        });
      }

      const priceDetails = await this.bookingService.getCheckoutPriceDetails(
        roomId,
        new Date(checkIn),
        new Date(checkOut),
        parseInt(guests)
      );

      return reply.send({
        success: true,
        data: priceDetails,
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        message: error.message || 'Failed to get price details',
      });
    }
  }

  // Cancel a booking
  async cancelBooking(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = CancelBookingParamsSchema.parse(request.params);
      const userId = request.user.id;
      const role = request.user.role;

      const booking = await this.bookingService.getBookingById(id);

      if (!booking) {
        return reply.code(404).send({
          success: false,
          message: 'Booking not found',
        });
      }

      // Check if the user is authorized to cancel this booking
      // Only the user who created the booking, hotel owner, or admin can cancel it
      const hotel = await this.hotelService.getHotelById(booking.hotelId);

      if (booking.userId !== userId && hotel?.ownerId !== userId && role !== 'admin') {
        return reply.code(403).send({
          success: false,
          message: 'Unauthorized. You do not have permission to cancel this booking',
        });
      }

      // Check if the booking is already cancelled or completed
      if (booking.status === 'cancelled') {
        return reply.code(400).send({
          success: false,
          message: 'Booking is already cancelled',
        });
      }

      if (booking.status === 'completed') {
        return reply.code(400).send({
          success: false,
          message: 'Cannot cancel a completed booking',
        });
      }

      const cancelledBooking = await this.bookingService.cancelBooking(id);

      return reply.code(200).send({
        success: true,
        message: 'Booking cancelled successfully',
        data: {
          booking: cancelledBooking
        }
      });
    } catch (error) {
      request.log.error(error);

      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
      }

      return reply.code(500).send({
        success: false,
        message: error.message || 'Failed to cancel booking',
      });
    }
  }

  // Get hotel bookings (for hotel owners and admins)
  async getHotelBookings(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = GetHotelBookingsParamsSchema.parse(request.params);
      const userId = request.user.id;
      const role = request.user.role;
      const { status, page = 1, limit = 10 } = request.query as any;

      const hotel = await this.hotelService.getHotelById(id);


      if (!hotel) {
        return reply.code(404).send({
          success: false,
          message: 'Hotel not found',
        });
      }

      // Check if the user is authorized to view hotel bookings
      // Only the hotel owner or admin can view all hotel bookings
      if (hotel.ownerId !== userId && role !== 'admin') {
        return reply.code(403).send({
          success: false,
          message: 'Unauthorized. You do not have permission to view bookings for this hotel',
        });
      }

      const result = await this.bookingService.getBookingsByHotelId(id, { status, page, limit });

      console.log('bookings ', result.bookings)

      return reply.code(200).send({
        success: true,
        message: 'Hotel bookings fetched successfully',
        data: {
          bookings: result.bookings,
          total: result.total,
          page: result.page,
          limit: result.limit
        }
      });
    } catch (error) {
      request.log.error(error);

      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
      }

      return reply.code(500).send({
        success: false,
        message: error.message || 'Failed to fetch hotel bookings',
      });
    }
  }
}