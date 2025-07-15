import { FastifyInstance } from 'fastify';
import { WishlistController } from '../controllers/wishlist.controller';
import {
  getWishlistSchema,
  addToWishlistSchema,
  removeFromWishlistSchema,
  checkWishlistSchema,
  getWishlistCountSchema,
  clearWishlistSchema
} from '../schemas/wishlist.schema';

const wishlistController = new WishlistController();

export default async function wishlistRoutes(fastify: FastifyInstance) {
  // Set fastify instance in the service
  wishlistController.setFastify(fastify);

  // All wishlist routes require authentication
  fastify.addHook('onRequest', fastify.authenticate);

  // Get user's wishlist
  fastify.get('/', {
    schema: getWishlistSchema,
    security: [{ bearerAuth: [] }]
  }, (request, reply) => wishlistController.getWishlist(request, reply));

  // Add hotel to wishlist
  fastify.post('/', {
    schema: addToWishlistSchema,
    security: [{ bearerAuth: [] }]
  }, (request, reply) => wishlistController.addToWishlist(request, reply));

  // Remove hotel from wishlist
  fastify.delete('/', {
    schema: removeFromWishlistSchema,
    security: [{ bearerAuth: [] }]
  }, (request, reply) => wishlistController.removeFromWishlist(request, reply));

  // Check if hotel is in wishlist
  fastify.get('/check', {
    schema: checkWishlistSchema,
    security: [{ bearerAuth: [] }]
  }, (request, reply) => wishlistController.checkWishlist(request, reply));

  // Get wishlist count
  fastify.get('/count', {
    schema: getWishlistCountSchema,
    security: [{ bearerAuth: [] }]
  }, (request, reply) => wishlistController.getWishlistCount(request, reply));

  // Clear entire wishlist
  fastify.delete('/clear', {
    schema: clearWishlistSchema,
    security: [{ bearerAuth: [] }]
  }, (request, reply) => wishlistController.clearWishlist(request, reply));
}