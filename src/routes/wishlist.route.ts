import { FastifyInstance } from 'fastify';
import { WishlistController } from '../controllers/wishlist.controller';

const wishlistController = new WishlistController();

export default async function wishlistRoutes(fastify: FastifyInstance) {
  // Set fastify instance in the service
  wishlistController.setFastify(fastify);

  // All wishlist routes require authentication
  fastify.addHook('onRequest', fastify.authenticate);

  // Get user's wishlist
  fastify.get('/', {
    schema: {
      tags: ['wishlist'],
      summary: 'Get user wishlist',
      description: 'Get the authenticated user\'s wishlist with pagination',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 }
        }
      }
    }
  }, (request, reply) => wishlistController.getWishlist(request, reply));

  // Add hotel to wishlist
  fastify.post('/', {
    schema: {
      tags: ['wishlist'],
      summary: 'Add hotel to wishlist',
      description: 'Add a hotel to the user\'s wishlist',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['hotelId'],
        properties: {
          hotelId: { type: 'string', format: 'uuid' }
        }
      }
    }
  }, (request, reply) => wishlistController.addToWishlist(request, reply));

  // Remove hotel from wishlist
  fastify.delete('/', {
    schema: {
      tags: ['wishlist'],
      summary: 'Remove hotel from wishlist',
      description: 'Remove a hotel from the user\'s wishlist',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['hotelId'],
        properties: {
          hotelId: { type: 'string', format: 'uuid' }
        }
      }
    }
  }, (request, reply) => wishlistController.removeFromWishlist(request, reply));

  // Check if hotel is in wishlist
  fastify.get('/check', {
    schema: {
      tags: ['wishlist'],
      summary: 'Check if hotel is in wishlist',
      description: 'Check if a specific hotel is in the user\'s wishlist',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        required: ['hotelId'],
        properties: {
          hotelId: { type: 'string', format: 'uuid' }
        }
      }
    }
  }, (request, reply) => wishlistController.checkWishlist(request, reply));

  // Get wishlist count
  fastify.get('/count', {
    schema: {
      tags: ['wishlist'],
      summary: 'Get wishlist count',
      description: 'Get the total number of hotels in user\'s wishlist',
      security: [{ bearerAuth: [] }]
    }
  }, (request, reply) => wishlistController.getWishlistCount(request, reply));

  // Clear entire wishlist
  fastify.delete('/clear', {
    schema: {
      tags: ['wishlist'],
      summary: 'Clear wishlist',
      description: 'Remove all hotels from the user\'s wishlist',
      security: [{ bearerAuth: [] }]
    }
  }, (request, reply) => wishlistController.clearWishlist(request, reply));
}