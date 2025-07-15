import { FastifyInstance } from 'fastify';
import { HotelSearchController } from '../controllers/hotelSearch.controller';

const hotelSearchController = new HotelSearchController();

export default async function hotelSearchRoutes(fastify: FastifyInstance) {
  // Set fastify instance in the service
  hotelSearchController.setFastify(fastify);

  // Main hotel search endpoint
  fastify.post('/search', {
    schema: {
      tags: ['hotel-search'],
      summary: 'Search hotels with filters',
      description: 'Search hotels based on location, dates, guests, and various filters',
      body: {
        type: 'object',
        properties: {
          coordinates: {
            type: 'object',
            properties: {
              lat: { type: 'number' },
              lng: { type: 'number' }
            }
          },
          city: { type: 'string' },
          dateRange: {
            type: 'object',
            properties: {
              startDate: { type: 'string', format: 'date-time' },
              endDate: { type: 'string', format: 'date-time' }
            }
          },
          guests: {
            type: 'object',
            properties: {
              adults: { type: 'integer', minimum: 1 },
              children: { type: 'integer', minimum: 0 },
              infants: { type: 'integer', minimum: 0 }
            },
            required: ['adults', 'children', 'infants']
          },
          priceRange: {
            type: 'object',
            properties: {
              min: { type: 'number' },
              max: { type: 'number' }
            }
          },
          starRating: { type: 'integer', minimum: 1, maximum: 5 },
          amenities: { type: 'array', items: { type: 'string' } },
          sortBy: { 
            type: 'string', 
            enum: ['recommended', 'price_low', 'price_high', 'rating', 'distance'],
            default: 'recommended'
          },
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 }
        }
      }
    }
  }, (request, reply) => hotelSearchController.searchHotels(request, reply));

  // Home page tabs
  fastify.get('/nearby', {
    schema: {
      tags: ['hotel-search'],
      summary: 'Get nearby hotels',
      description: 'Get hotels near user location for home page',
      querystring: {
        type: 'object',
        properties: {
          coordinates: {
            type: 'object',
            properties: {
              lat: { type: 'number' },
              lng: { type: 'number' }
            }
          },
          limit: { type: 'integer', minimum: 1, maximum: 20, default: 10 }
        }
      }
    }
  }, (request, reply) => hotelSearchController.getNearbyHotels(request, reply));

  fastify.get('/latest', {
    schema: {
      tags: ['hotel-search'],
      summary: 'Get latest hotels',
      description: 'Get recently added hotels for home page',
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 20, default: 10 }
        }
      }
    }
  }, (request, reply) => hotelSearchController.getLatestHotels(request, reply));

  fastify.get('/offers', {
    schema: {
      tags: ['hotel-search'],
      summary: 'Get hotels with offers',
      description: 'Get hotels with active offers/coupons for home page',
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 20, default: 10 }
        }
      }
    }
  }, (request, reply) => hotelSearchController.getOffersHotels(request, reply));
}