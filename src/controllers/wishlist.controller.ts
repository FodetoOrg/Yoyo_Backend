import { FastifyRequest, FastifyReply } from 'fastify';
import { WishlistService } from '../services/wishlist.service';
import { z } from 'zod';
import {
  AddToWishlistSchema,
  RemoveFromWishlistSchema,
  CheckWishlistSchema,
  WishlistQuerySchema
} from '../schemas/wishlist.schema';

export class WishlistController {
  private wishlistService: WishlistService;

  constructor() {
    this.wishlistService = new WishlistService();
  }

  setFastify(fastify: any) {
    this.wishlistService.setFastify(fastify);
  }

  // Get user's wishlist
  async getWishlist(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = (request as any).user.id;
      const { page, limit } = WishlistQuerySchema.parse(request.query);
      
      const result = await this.wishlistService.getUserWishlist(userId, page, limit);
      
      return reply.code(200).send({
        success: true,
        data: result,
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
        message: error.message || 'Failed to get wishlist',
      });
    }
  }

  // Add hotel to wishlist
  async addToWishlist(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = (request as any).user.id;
      const { hotelId } = AddToWishlistSchema.parse(request.body);
      
      const result = await this.wishlistService.addToWishlist(userId, hotelId);
      
      return reply.code(201).send({
        success: true,
        data: result,
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
      
      const statusCode = error.statusCode || 500;
      return reply.code(statusCode).send({
        success: false,
        message: error.message || 'Failed to add to wishlist',
      });
    }
  }

  // Remove hotel from wishlist
  async removeFromWishlist(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = (request as any).user.id;
      const { hotelId } = RemoveFromWishlistSchema.parse(request.body);
      
      const result = await this.wishlistService.removeFromWishlist(userId, hotelId);
      
      return reply.code(200).send({
        success: true,
        data: result,
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
      
      const statusCode = error.statusCode || 500;
      return reply.code(statusCode).send({
        success: false,
        message: error.message || 'Failed to remove from wishlist',
      });
    }
  }

  // Check if hotel is in wishlist
  async checkWishlist(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = (request as any).user.id;
      const { hotelId } = CheckWishlistSchema.parse(request.query);
      
      const result = await this.wishlistService.isInWishlist(userId, hotelId);
      
      return reply.code(200).send({
        success: true,
        data: result,
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
        message: error.message || 'Failed to check wishlist',
      });
    }
  }

  // Get wishlist count
  async getWishlistCount(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = (request as any).user.id;
      const result = await this.wishlistService.getWishlistCount(userId);
      
      return reply.code(200).send({
        success: true,
        data: result,
      });
    } catch (error) {
      request.log.error(error);
      
      return reply.code(500).send({
        success: false,
        message: error.message || 'Failed to get wishlist count',
      });
    }
  }

  // Clear wishlist
  async clearWishlist(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = (request as any).user.id;
      const result = await this.wishlistService.clearWishlist(userId);
      
      return reply.code(200).send({
        success: true,
        data: result,
      });
    } catch (error) {
      request.log.error(error);
      
      return reply.code(500).send({
        success: false,
        message: error.message || 'Failed to clear wishlist',
      });
    }
  }
}