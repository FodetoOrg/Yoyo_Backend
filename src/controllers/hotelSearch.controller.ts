import { FastifyRequest, FastifyReply } from 'fastify';
import { HotelSearchService } from '../services/hotelSearch.service';
import { z } from 'zod';

const searchHotelsSchema = z.object({
  // Location
  coordinates: z.object({
    lat: z.number(),
    lng: z.number(),
  }).optional(),
  city: z.string().optional(),
  radius: z.number().default(50),
  
  // Dates and guests
  dateRange: z.object({
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
  }).optional(),
  guests: z.object({
    adults: z.number().int().min(1),
    children: z.number().int().min(0),
    infants: z.number().int().min(0),
  }),
  
  // Filters
  priceRange: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
  }).optional(),
  starRating: z.number().int().min(1).max(5).optional(),
  amenities: z.array(z.string()).optional(),
  sortBy: z.enum(['recommended', 'price_low', 'price_high', 'rating', 'distance']).default('recommended'),
  
  // Pagination
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(50).default(10),
});

const homeTabSchema = z.object({
  coordinates: z.object({
    lat: z.number(),
    lng: z.number(),
  }).optional(),
  limit: z.number().int().min(1).max(20).default(10),
});

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
      const searchData = searchHotelsSchema.parse(request.body);
      
      const searchFilters = {
        coordinates: searchData.coordinates,
        city: searchData.city,
        radius: searchData.radius,
        checkIn: searchData.dateRange ? new Date(searchData.dateRange.startDate) : undefined,
        checkOut: searchData.dateRange ? new Date(searchData.dateRange.endDate) : undefined,
        adults: searchData.guests.adults,
        children: searchData.guests.children,
        infants: searchData.guests.infants,
        priceRange: searchData.priceRange,
        starRating: searchData.starRating,
        amenities: searchData.amenities,
        sortBy: searchData.sortBy,
        page: searchData.page,
        limit: searchData.limit,
      };

      const result = await this.hotelSearchService.searchHotels(searchFilters);
      
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
        message: error.message || 'Failed to search hotels',
      });
    }
  }

  // Home page - Nearby hotels
  async getNearbyHotels(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { coordinates, limit } = homeTabSchema.parse(request.query);
      const userId = (request as any).user?.id;
      
      const hotels = await this.hotelSearchService.getNearbyHotels({
        userId,
        coordinates,
        limit,
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

  // Home page - Latest hotels
  async getLatestHotels(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { limit } = homeTabSchema.parse(request.query);
      const userId = (request as any).user?.id;
      
      const hotels = await this.hotelSearchService.getLatestHotels({
        userId,
        limit,
      });
      
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
      const { limit } = homeTabSchema.parse(request.query);
      const userId = (request as any).user?.id;
      
      const hotels = await this.hotelSearchService.getOffersHotels({
        userId,
        limit,
      });
      
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