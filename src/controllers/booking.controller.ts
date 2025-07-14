import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { BookingService } from '../services/booking.service';
import { HotelService } from '../services/hotel.service';

// Validation schemas
const createBookingSchema = z.object({
  hotelId: z.string().uuid(),
  roomId: z.string().uuid(),
  checkInDate: z.string().refine(val => !isNaN(Date.parse(val)), {
    message: "Invalid date format for check-in date"
  }),
  checkOutDate: z.string().refine(val => !isNaN(Date.parse(val)), {
    message: "Invalid date format for check-out date"
  }),
  bookingType: z.enum(['daily', 'hourly']).default('daily'),
  totalHours: z.number().int().positive().optional(),
  guestCount: z.number().int().positive().default(1),
  specialRequests: z.string().optional(),
});

const bookingIdParamSchema = z.object({
  id: z.string().uuid()
});

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
      const bookingData = createBookingSchema.parse(request.body);
      const userId = request.user.id as string;
      
      // Check if room exists and is available
      const room = await this.hotelService.getRoomById(bookingData.roomId);
      
      if (!room) {
        return reply.code(404).send({
          success: false,
          message: 'Room not found',
        });
      }
      
      if (!room.available) {
        return reply.code(400).send({
          success: false,
          message: 'Room is not available for booking',
        });
      }
      
      // Validate room belongs to the specified hotel
      if (room.hotelId !== bookingData.hotelId) {
        return reply.code(400).send({
          success: false,
          message: 'Room does not belong to the specified hotel',
        });
      }
      
      // Check if the room is already booked for the requested dates
      const isRoomAvailable = await this.bookingService.checkRoomAvailability(
        bookingData.roomId,
        new Date(bookingData.checkInDate),
        new Date(bookingData.checkOutDate),
        bookingData.bookingType
      );
      
      if (!isRoomAvailable) {
        return reply.code(400).send({
          success: false,
          message: 'Room is not available for the selected dates',
        });
      }
      
      // Calculate total amount based on booking type (hourly or daily)
      let totalAmount = 0;
      
      if (bookingData.bookingType === 'hourly') {
        if (!bookingData.totalHours || !room.pricePerHour) {
          return reply.code(400).send({
            success: false,
            message: 'Total hours must be provided for hourly booking or room does not support hourly booking',
          });
        }
        totalAmount = room.pricePerHour * bookingData.totalHours;
      } else {
        // Calculate number of days
        const checkInDate = new Date(bookingData.checkInDate);
        const checkOutDate = new Date(bookingData.checkOutDate);
        const diffTime = Math.abs(checkOutDate.getTime() - checkInDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        totalAmount = room.pricePerNight * diffDays;
      }
      
      // Create booking
      const booking = await this.bookingService.createBooking({
        ...bookingData,
        userId,
        totalAmount,
        checkInDate: new Date(bookingData.checkInDate),
        checkOutDate: new Date(bookingData.checkOutDate),
      });
      
      return reply.code(201).send({
        success: true,
        message: 'Booking created successfully',
        data: {
          booking,
          paymentInfo: {
            totalAmount,
            currency: 'INR',
            paymentMode: booking.paymentMode,
            requiresOnlinePayment: booking.requiresOnlinePayment,
            advanceAmount: booking.advanceAmount,
            remainingAmount: booking.remainingAmount,
            paymentDueDate: booking.paymentDueDate
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
      const { id } = bookingIdParamSchema.parse(request.params);
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

  // Get user's bookings
  async getUserBookings(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = request.user.id;
      
      const bookings = await this.bookingService.getBookingsByUserId(userId);
      
      return reply.code(200).send({
        success: true,
        message: 'User bookings fetched successfully',
        data: {
          bookings,
          count: bookings.length
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

  // Cancel a booking
  async cancelBooking(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = bookingIdParamSchema.parse(request.params);
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
      const { id } = hotelIdParamSchema.parse(request.params);
      const userId = request.user.id;
      const role = request.user.role;
      
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
      
      const bookings = await this.bookingService.getBookingsByHotelId(id);
      
      return reply.code(200).send({
        success: true,
        message: 'Hotel bookings fetched successfully',
        data: {
          bookings,
          count: bookings.length
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