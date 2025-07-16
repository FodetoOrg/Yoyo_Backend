import { FastifyInstance } from 'fastify';
import { BookingController } from '../controllers/booking.controller';
import {
  createBookingSchema,
  getBookingByIdSchema,
  getUserBookingsSchema,
  getHotelBookingsSchema,
  cancelBookingSchema
} from '../schemas/booking.schema';
import { rbacGuard } from '../plugins/rbacGuard';
import { permissions } from '../utils/rbac';

const bookingController = new BookingController();

export default async function bookingRoutes(fastify: FastifyInstance) {
  // Set fastify instance in the booking and hotel services
  bookingController['bookingService'].setFastify(fastify);
  bookingController['hotelService'].setFastify(fastify);

  // All booking routes require authentication
  fastify.addHook('onRequest', fastify.authenticate);

  // Create a new booking
  fastify.post('/', {
    schema: {
      ...createBookingSchema,
      tags: ['bookings'],
      summary: 'Create a new booking',
      security: [{ bearerAuth: [] }]
    },
    // preHandler: rbacGuard(permissions.createBooking)
  }, (request, reply) => bookingController.createBooking(request, reply));
  
  // Get booking by ID
  fastify.get('/:id', {
    schema: {
      ...getBookingByIdSchema,
      tags: ['bookings'],
      summary: 'Get booking by ID',
      security: [{ bearerAuth: [] }]
    }
  }, (request, reply) => bookingController.getBookingById(request, reply));
  
  // Get user's bookings
  fastify.get('/user/me', {
    schema: {
      ...getUserBookingsSchema,
      tags: ['bookings'],
      summary: 'Get user\'s bookings',
      security: [{ bearerAuth: [] }]
    }
  }, (request, reply) => bookingController.getUserBookings(request, reply));
  
  // Get hotel bookings
  fastify.get('/hotel/:id', {
    schema: {
      ...getHotelBookingsSchema,
      tags: ['bookings'],
      summary: 'Get hotel bookings',
      security: [{ bearerAuth: [] }]
    }
  }, (request, reply) => bookingController.getHotelBookings(request, reply));
  
  // Cancel a booking
  fastify.put('/:id/cancel', {
    schema: {
      ...cancelBookingSchema,
      tags: ['bookings'],
      summary: 'Cancel a booking',
      security: [{ bearerAuth: [] }]
    }
  }, (request, reply) => bookingController.cancelBooking(request, reply));
}