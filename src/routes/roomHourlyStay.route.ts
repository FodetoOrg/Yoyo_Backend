
import { FastifyInstance } from 'fastify';
import { RoomHourlyStayController } from '../controllers/roomHourlyStay.controller';
import { UserRole } from '@/types/common';

export async function roomHourlyStayRoutes(fastify: FastifyInstance) {
  const roomHourlyStayController = new RoomHourlyStayController();
  roomHourlyStayController.setFastify(fastify);

  // Create hourly stay
  fastify.post('/hourly-stays', {
    onRequest: [fastify.authenticate, fastify.rbacGuard(['admin', 'hotel_manager'])],
  }, roomHourlyStayController.createHourlyStay.bind(roomHourlyStayController));

  // Get hourly stays by room
  fastify.get('/rooms/:roomId/hourly-stays', {
    onRequest: [fastify.authenticate],
  }, roomHourlyStayController.getHourlyStaysByRoom.bind(roomHourlyStayController));

  // Get hourly stays by hotel
  fastify.get('/hotels/:hotelId/hourly-stays', {
    onRequest: [fastify.authenticate],
  }, roomHourlyStayController.getHourlyStaysByHotel.bind(roomHourlyStayController));

  // Update hourly stay
  fastify.put('/hourly-stays/:id', {
    onRequest: [fastify.authenticate, fastify.rbacGuard([UserRole.HOTEL_ADMIN, UserRole.HOTEL_ADMIN])],
  }, roomHourlyStayController.updateHourlyStay.bind(roomHourlyStayController));

  // Delete hourly stay
  fastify.delete('/hourly-stays/:id', {
    onRequest: [fastify.authenticate, fastify.rbacGuard([UserRole.HOTEL_ADMIN, UserRole.HOTEL_ADMIN])],
  }, roomHourlyStayController.deleteHourlyStay.bind(roomHourlyStayController));
}
