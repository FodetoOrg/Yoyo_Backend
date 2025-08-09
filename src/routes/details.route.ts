
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DetailsController } from '../controllers/details.controller';
import { z } from 'zod';

const detailsController = new DetailsController();

export default async function detailsRoutes(fastify: FastifyInstance) {
  detailsController.setFastify(fastify);

  // Room details with bookings, payments, addons, and refunds
  fastify.get('/rooms/:roomId/details', {
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
    detailsController.getRoomDetails(request, reply)
  );

  // Payment details with booking, user, room, and hotel information
  fastify.get('/payments/:paymentId/details', {
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
    detailsController.getPaymentDetails(request, reply)
  );

  // Refund details with booking, user, room, and hotel information
  fastify.get('/refunds/:refundId/details', {
    schema: {
      tags: ['details'],
      summary: 'Get comprehensive refund details',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          refundId: { type: 'string', format: 'uuid' }
        },
        required: ['refundId']
      }
    },
    preHandler: [fastify.authenticate]
  }, (request: FastifyRequest, reply: FastifyReply) => 
    detailsController.getRefundDetails(request, reply)
  );

  // Hotel details with rooms, stats, bookings, payments, refunds, and addons (admin only)
  fastify.get('/hotels/:hotelId/details', {
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
}
