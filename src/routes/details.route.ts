import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DetailsController } from '../controllers/details.controller';
import { z } from 'zod';
import { getAllWalletUsages } from '../controllers/details.controller';
import { getAllRefunds } from '../controllers/details.controller';
import { createReview, getEligibleBookingsForReview } from '../controllers/details.controller';

const detailsController = new DetailsController();

export default async function detailsRoutes(fastify: FastifyInstance) {
  detailsController.setFastify(fastify);

  // Get all wallet usages (admin only)
  fastify.get('/details/wallet-usages', {
    preHandler: [fastify.authenticate,
      //  rbacGuard(['superadmin'])
      ]
  }, getAllWalletUsages);

  // Get all refunds (admin only)
  fastify.get('/details/refunds', {
    preHandler: [fastify.authenticate,
      //  rbacGuard(['superadmin'])
      ]
  }, getAllRefunds);

  // Create review
  fastify.post('/reviews', {
    schema: {
      tags: ['reviews'],
      summary: 'Create a review for a completed booking',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['hotelId', 'bookingId', 'rating'],
        properties: {
          hotelId: { type: 'string' },
          bookingId: { type: 'string' },
          rating: { type: 'number', minimum: 1, maximum: 5 },
          comment: { type: 'string', maxLength: 1000 }
        }
      }
    },
    preHandler: [fastify.authenticate]
  }, createReview);

  // Get eligible bookings for review
  fastify.get('/reviews/eligible-bookings', {
    schema: {
      tags: ['reviews'],
      summary: 'Get user bookings eligible for review',
      security: [{ bearerAuth: [] }]
    },
    preHandler: [fastify.authenticate]
  }, getEligibleBookingsForReview);


  // Room details with bookings, payments, addons, and refunds
  fastify.get('/rooms/:roomId', {
    schema: {
      tags: ['details'],
      summary: 'Get comprehensive room details',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          roomId: { type: 'string', format: 'uuid' }
        },
        required: ['roomId']
      }
    },
    preHandler: [fastify.authenticate]
  }, (request: FastifyRequest, reply: FastifyReply) => 
    detailsController.getRoomDetails(request as any, reply)
  );

  // Payment details with booking, user, room, and hotel information
  fastify.get('/payments/:paymentId', {
    schema: {
      tags: ['details'],
      summary: 'Get comprehensive payment details',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          paymentId: { type: 'string', format: 'uuid' }
        },
        required: ['paymentId']
      }
    },
    preHandler: [fastify.authenticate]
  }, (request: FastifyRequest, reply: FastifyReply) => 
    detailsController.getPaymentDetails(request as any, reply)
  );



  // Hotel details with rooms, stats, bookings, payments, refunds, and addons (admin only)
  fastify.get('/hotels/:hotelId', {
    schema: {
      tags: ['details'],
      summary: 'Get comprehensive hotel details for admin',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          hotelId: { type: 'string', format: 'uuid' }
        },
        required: ['hotelId']
      }
    },
    preHandler: [fastify.authenticate]
  }, (request: FastifyRequest, reply: FastifyReply) => 
    detailsController.getHotelDetails(request, reply)
  );

  // Refund details
  fastify.get('/refunds/:refundId', {
    onRequest: [fastify.authenticate],
    schema: {
      tags: ['details'],
      summary: 'Get refund details',
      params: {
        type: 'object',
        required: ['refundId'],
        properties: {
          refundId: { type: 'string' }
        }
      }
    }
  }, detailsController.getRefundDetails.bind(detailsController));

  // Customer details
  fastify.get('/customers/:customerId', {
    onRequest: [fastify.authenticate],
    schema: {
      tags: ['details'],
      summary: 'Get customer details with bookings, payments, refunds, and wallet transactions',
      params: {
        type: 'object',
        required: ['customerId'],
        properties: {
          customerId: { type: 'string' }
        }
      }
    }
  }, detailsController.getCustomerDetails.bind(detailsController));

  // Addon details
  fastify.get('/addons/:addonId', {
    onRequest: [fastify.authenticate],
    schema: {
      tags: ['details'],
      summary: 'Get addon details with usage statistics and booking history',
      params: {
        type: 'object',
        required: ['addonId'],
        properties: {
          addonId: { type: 'string' }
        }
      }
    }
  }, detailsController.getAddonDetails.bind(detailsController));
}