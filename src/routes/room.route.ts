import { FastifyInstance } from 'fastify';
import { RoomController } from '../controllers/room.controller';
import {
  getRoomsSchema,
  getRoomByIdSchema,
  createRoomSchema,
  updateRoomSchema,
  deleteRoomSchema,
  getRoomStatisticsSchema,
} from '../schemas/room.schema';
import { rbacGuard } from '../plugins/rbacGuard';
import { permissions } from '../utils/rbac';

const roomController = new RoomController();

export default async function roomRoutes(fastify: FastifyInstance) {
  // Set fastify instance in the service
  roomController.setFastify(fastify);

  // All room routes require authentication
  fastify.addHook('onRequest', fastify.authenticate);

  // Get all rooms with advanced filtering (Admin + Hotel Admin)
  fastify.get('/', {
    schema: {
      ...getRoomsSchema,
      tags: ['rooms'],
      summary: 'Get all rooms with advanced filtering',
      security: [{ bearerAuth: [] }]
    }
  }, (request, reply) => roomController.getAllRooms(request, reply));

  // Get rooms by hotel (Admin + Hotel Admin)
  fastify.get('/by-hotel', {
    schema: {
      ...getRoomsSchema,
      tags: ['rooms'],
      summary: 'Get rooms by hotel ID',
      security: [{ bearerAuth: [] }]
    }
  }, (request, reply) => roomController.getRoomsByHotel(request, reply));

  // Get room by ID (Admin + Hotel Admin)
  fastify.get('/:id', {
    schema: {
      ...getRoomByIdSchema,
      tags: ['rooms'],
      summary: 'Get room by ID',
      security: [{ bearerAuth: [] }]
    }
  }, (request, reply) => roomController.getRoomById(request, reply));

  // Create room (Admin + Hotel Admin)
  fastify.post('/', {
    schema: {
      ...createRoomSchema,
      tags: ['rooms'],
      summary: 'Create a new room',
      security: [{ bearerAuth: [] }]
    },
    preHandler: rbacGuard(permissions.createRoom)
  }, (request, reply) => roomController.createRoom(request, reply));

  // Update room (Admin + Hotel Admin)
  fastify.put('/:id', {
    schema: {
      ...updateRoomSchema,
      tags: ['rooms'],
      summary: 'Update room',
      security: [{ bearerAuth: [] }]
    },
    preHandler: rbacGuard(permissions.createRoom) // Using same permission for update
  }, (request, reply) => roomController.updateRoom(request, reply));

  // Delete room (Admin + Hotel Admin)
  fastify.delete('/:id', {
    schema: {
      ...deleteRoomSchema,
      tags: ['rooms'],
      summary: 'Delete room',
      security: [{ bearerAuth: [] }]
    },
    preHandler: rbacGuard(permissions.createRoom) // Using same permission for delete
  }, (request, reply) => roomController.deleteRoom(request, reply));

  // Get room statistics (Admin + Hotel Admin)
  fastify.get('/statistics/overview', {
    schema: {
      ...getRoomStatisticsSchema,
      tags: ['rooms'],
      summary: 'Get room statistics',
      security: [{ bearerAuth: [] }]
    }
  }, (request, reply) => roomController.getRoomStatistics(request, reply));
}