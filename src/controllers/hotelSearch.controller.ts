// @ts-nocheck
import { FastifyRequest, FastifyReply } from 'fastify';
import { HotelSearchService } from '../services/hotelSearch.service';
import { z } from 'zod';
import { SearchHotelsRequestSchema, HomeTabQuerySchema } from '../schemas/hotelSearch.schema';

export class HotelSearchController {
  private hotelSearchService: HotelSearchService;

  constructor() {
    this.hotelSearchService = new HotelSearchService();
  }

  setFastify(fastify: any) {
    this.hotelSearchService.setFastify(fastify);
  }

  // Main hotel search
  async searchHotels(request: FastifyRequest, reply: FastifyReply) {
    try {
      const searchData = SearchHotelsRequestSchema.parse(request.body);

      console.log('searchData ',searchData)

      const searchFilters = {
        coordinates: searchData.coordinates,
        city: searchData.city,
        radius: searchData.radius,
        checkIn: searchData.dateRange ? new Date(searchData.dateRange.startDate+'Z') : undefined,
        checkOut: searchData.dateRange ? new Date(searchData.dateRange.endDate+'Z') : undefined,
        adults: searchData.guests.adults,
        children: searchData.guests.children,
        infants: searchData.guests.infants,
        bookingType: searchData.bookingType,
        priceRange: searchData.priceRange,
        starRating: searchData.starRating,
        amenities: searchData.amenities,
        sortBy: searchData.sortBy,
        page: searchData.page,
        limit: searchData.limit,
        isNearby: false
      };

      console.log('searchFilters ',searchFilters)

      // Prioritize coordinates-based search over city-based search
      if (searchFilters.coordinates && (!searchFilters.city || searchFilters.city.trim() === '')) {
        // If we have coordinates but no city, we can still search by location
        request.log.info('Performing coordinates-based search without city filter');
      } else if (searchFilters.coordinates && searchFilters.city) {
        // If we have both, we'll use coordinates as the primary filter but keep city for context
        request.log.info('Performing coordinates-based search with city context');
      } else if (searchFilters.city && (!searchFilters.coordinates)) {
        // Fallback to city-only search if no coordinates
        request.log.info('Performing city-based search without coordinates');
      }

      const result = await this.hotelSearchService.searchHotels(searchFilters);

      console.log('result ', JSON.stringify(result))

      return reply.code(200).send({
        success: true,
        data: result,
      });
    } catch (error) {
      request.log.error(error);
      console.log('error ', error)

      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
      }

      return reply.code(500).send({
        success: false,
        message: error.message || 'Failed to search hotels',
      });
    }
  }

  // Home page - Nearby hotels (simple version for home page tabs)
  async getNearbyHotels(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { lat, lng, limit, sortBy } = HomeTabQuerySchema.parse(request.query);
      const userId = (request as any).user?.id;

      const coordinates = {
        lat,
        lng
      }

      const hotels = await this.hotelSearchService.getNearbyHotels({
        userId,
        coordinates,
        limit,
        sortBy
      });

      return reply.code(200).send({
        success: true,
        data: {
          hotels,
          type: 'nearby',
        },
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
        message: error.message || 'Failed to get nearby hotels',
      });
    }
  }

  // Enhanced nearby search with full filtering support
  async searchNearbyHotels(request: FastifyRequest, reply: FastifyReply) {
    try {
      const searchData = SearchHotelsRequestSchema.parse(request.body);

      // Ensure coordinates are provided for nearby search
      if (!searchData.coordinates) {
        return reply.code(400).send({
          success: false,
          message: 'Coordinates are required for nearby search',
        });
      }

      const searchFilters = {
        coordinates: searchData.coordinates,
        radius: searchData.radius || 25, // Default 25km for nearby
        checkIn: searchData.dateRange ? new Date(searchData.dateRange.startDate + 'Z') : undefined,
        checkOut: searchData.dateRange ? new Date(searchData.dateRange.endDate + 'Z') : undefined,
        adults: searchData.guests.adults,
        children: searchData.guests.children,
        infants: searchData.guests.infants,
        bookingType: searchData.bookingType,
        priceRange: searchData.priceRange,
        starRating: searchData.starRating,
        amenities: searchData.amenities,
        sortBy: searchData.sortBy || 'distance',
        page: searchData.page,
        limit: searchData.limit,
        isNearby: false // Allow full availability checking
      };

      const result = await this.hotelSearchService.searchNearbyHotels(searchFilters);

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
        message: error.message || 'Failed to search nearby hotels',
      });
    }
  }

  // Home page - Latest hotels
  async getLatestHotels(request: FastifyRequest, reply: FastifyReply) {
    try {
      // Only validate the limit parameter
      const querySchema = z.object({
        limit: z.number().int().min(1).max(20).default(10),
        coordinates: z.object({
          lat: z.number(),
          lng: z.number()
        }).optional().nullable()
      });

      const { limit } = querySchema.parse(request.query);
      const userId = (request as any).user?.id;

      const hotels = await this.hotelSearchService.getLatestHotels({
        userId,
        limit,
      });

      // console.log('hotels in atest ',JSON.stringify(hotels))

      return reply.code(200).send({
        success: true,
        data: {
          hotels,
          type: 'latest',
        },
      });
    } catch (error) {
      request.log.error(error);

      return reply.code(500).send({
        success: false,
        message: error.message || 'Failed to get latest hotels',
      });
    }
  }

  // Home page - Hotels with offers
  async getOffersHotels(request: FastifyRequest, reply: FastifyReply) {
    try {
      // Only validate the limit parameter
      const querySchema = z.object({
        limit: z.number().int().min(1).max(20).default(10),
        coordinates: z.object({
          lat: z.number(),
          lng: z.number()
        }).optional().nullable()
      });

      const { limit } = querySchema.parse(request.query);
      const userId = (request as any).user?.id;

      const hotels = await this.hotelSearchService.getOffersHotels({
        userId,
        limit,
      });

      console.log('offers ', hotels)
      return reply.code(200).send({
        success: true,
        data: {
          hotels,
          type: 'offers',
        },
      });
    } catch (error) {
      request.log.error(error);

      return reply.code(500).send({
        success: false,
        message: error.message || 'Failed to get hotels with offers',
      });
    }
  }
}