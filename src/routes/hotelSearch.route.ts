import { FastifyInstance } from 'fastify';
import { HotelSearchController } from '../controllers/hotelSearch.controller';
import {
  searchHotelsSchema,
  getNearbyHotelsSchema,
  getLatestHotelsSchema,
  getOffersHotelsSchema
} from '../schemas/hotelSearch.schema';

const hotelSearchController = new HotelSearchController();

export default async function hotelSearchRoutes(fastify: FastifyInstance) {
  // Set fastify instance in the service
  hotelSearchController.setFastify(fastify);

  // Main hotel search endpoint
  fastify.post('/search', {
    // schema: searchHotelsSchema
  }, (request, reply) => hotelSearchController.searchHotels(request, reply));

  // Enhanced nearby search with full filtering support
  fastify.post('/nearby', {
    // schema: searchHotelsSchema
  }, (request, reply) => hotelSearchController.searchNearbyHotels(request, reply));

  // Home page tabs (simple versions without full filtering)
  fastify.get('/nearby', {
    schema: getNearbyHotelsSchema
  }, (request, reply) => hotelSearchController.getNearbyHotels(request, reply));

  fastify.get('/latest', {
    schema: getLatestHotelsSchema
  }, (request, reply) => hotelSearchController.getLatestHotels(request, reply));

  fastify.get('/offers', {
    schema: getOffersHotelsSchema
  }, (request, reply) => hotelSearchController.getOffersHotels(request, reply));

  fastify.get('/featured', {

  }, (request, reply) => hotelSearchController.getFeaturedHotels(request, reply))
}