import { FastifyInstance } from 'fastify';
import { BookingController } from '../controllers/booking.controller';
import {
  createBookingSchema,
  getBookingByIdSchema,
  getUserBookingsSchema,
  getHotelBookingsSchema,
  cancelBookingSchema,
  getBookingDetailsSchema,
  getAllBookingsSchema
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

  // Get detailed booking information
  fastify.get('/:id/details', {
    schema: {
      ...getBookingDetailsSchema,
      tags: ['bookings'],
      summary: 'Get detailed booking information',
      security: [{ bearerAuth: [] }]
    }
  }, (request, reply) => bookingController.getBookingDetails(request, reply));

  // Get all bookings (admin only)
  fastify.get('/', {
    schema: {
      ...getAllBookingsSchema,
      tags: ['bookings'],
      summary: 'Get all bookings (admin only)',
      security: [{ bearerAuth: [] }]
    },
    preHandler: [fastify.authenticate]
  }, (request, reply) => bookingController.getAllBookings(request, reply));

  // Get user's bookings
  fastify.get('/user/me', {
    schema: {
      ...getUserBookingsSchema,
      tags: ['bookings'],
      summary: 'Get user\'s bookings',
      security: [{ bearerAuth: [] }]
    },
    preHandler:[fastify.authenticate]
  }, (request, reply) => bookingController.getUserBookings(request, reply));

  // Get hotel bookings
  fastify.get('/hotel/:id', {
    schema: {
      ...getHotelBookingsSchema,
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['pending', 'confirmed', 'cancelled', 'completed'] },
          page: { type: 'number', minimum: 1, default: 1 },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 10 }
        }
      },
      tags: ['bookings'],
      summary: 'Get hotel bookings',
      security: [{ bearerAuth: [] }]
    }
  }, (request, reply) => bookingController.getHotelBookings(request, reply));

  // Get checkout price details
  fastify.get('/checkout/price-details', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          roomId: { type: 'string' },
          checkIn: { type: 'string', format: 'date' },
          checkOut: { type: 'string', format: 'date' },
          guests: { type: 'number', minimum: 1 }
        },
        required: ['roomId', 'checkIn', 'checkOut', 'guests']
      },
      tags: ['bookings'],
      summary: 'Get checkout price details',
      security: [{ bearerAuth: [] }]
    }
  }, (request, reply) => bookingController.getCheckoutPriceDetails(request, reply));

  // Cancel a booking
  fastify.put('/:id/cancel', {
    schema: {
      ...cancelBookingSchema,
      body: {
        type: 'object',
        properties: {
          reason: { type: 'string', minLength: 1 }
        },
        required: ['reason']
      },
      tags: ['bookings'],
      summary: 'Cancel a booking',
      security: [{ bearerAuth: [] }],
      preHandler: [fastify.authenticate],
    }
  }, (request, reply) => bookingController.cancelBooking(request, reply));

  

  // Update booking status (admin/hotel only)
  fastify.put('/:bookingId/status', {
    schema: {
      body: {
        type: 'object',
        properties: {
          status: { 
            type: 'string', 
            enum: ['confirmed', 'cancelled', 'checked-in', 'completed'] 
          },
          reason: { type: 'string' }
        },
        required: ['status'],
        if: { properties: { status: { const: 'cancelled' } } },
        then: { required: ['status', 'reason'] }
      },
      tags: ['bookings'],
      summary: 'Update booking status (admin/hotel only)',
      security: [{ bearerAuth: [] }]
    }
  }, (request, reply) => bookingController.updateBookingStatus(request, reply));

  // Update guest details
  fastify.put('/:bookingId/guest-details', {
    schema: {
      body: {
        type: 'object',
        properties: {
          guestName: { type: 'string', minLength: 1 },
          guestEmail: { type: 'string', format: 'email' },
          guestPhone: { type: 'string', minLength: 10 }
        },
        required: ['guestName', 'guestEmail', 'guestPhone']
      },
      tags: ['bookings'],
      summary: 'Update guest details',
      security: [{ bearerAuth: [] }]
    },
    preHandler:[fastify.authenticate]
  }, (request, reply) => bookingController.updateGuestDetails(request, reply));
}