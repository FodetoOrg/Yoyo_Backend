import { FastifyInstance } from 'fastify';
import { RoomTypeController } from '../controllers/roomType.controller';
import {
  getRoomTypesSchema,
  getRoomTypeByIdSchema,
  createRoomTypeSchema,
  updateRoomTypeSchema,
  deleteRoomTypeSchema,
} from '../schemas/roomType.schema';
import { rbacGuard } from '../plugins/rbacGuard';
import { permissions } from '../utils/rbac';

const roomTypeController = new RoomTypeController();

export default async function roomTypeRoutes(fastify: FastifyInstance) {
  // Set fastify instance in the service
  roomTypeController.setFastify(fastify);

  // Get all room types
  fastify.get('/', {
    schema: {
      ...getRoomTypesSchema,
      tags: ['room-types'],
      summary: 'Get all room types',
      security: [{ bearerAuth: [] }]
    },
    preHandler: [fastify.authenticate]
  }, (request, reply) => roomTypeController.getRoomTypes(request, reply));

  // Get room type by ID
  fastify.get('/:id', {
    schema: {
      ...getRoomTypeByIdSchema,
      tags: ['room-types'],
      summary: 'Get room type by ID',
      security: [{ bearerAuth: [] }]
    },
    preHandler: [fastify.authenticate]
  }, (request, reply) => roomTypeController.getRoomTypeById(request, reply));

  // Create room type (Super admin only)
  fastify.post('/', {
    schema: {
      ...createRoomTypeSchema,
      tags: ['room-types'],
      summary: 'Create a new room type',
      security: [{ bearerAuth: [] }]
    },
    preHandler: [
      fastify.authenticate,
      rbacGuard(permissions.createRoomType)
    ]
  }, (request, reply) => roomTypeController.createRoomType(request, reply));

  // Update room type (Super admin only)
  fastify.put('/:id', {
    schema: {
      ...updateRoomTypeSchema,
      tags: ['room-types'],
      summary: 'Update room type',
      security: [{ bearerAuth: [] }]
    },
    preHandler: [
      fastify.authenticate,
      rbacGuard(permissions.updateRoomType)
    ]
  }, (request, reply) => roomTypeController.updateRoomType(request, reply));

  // Delete room type (Super admin only)
  fastify.delete('/:id', {
    schema: {
      ...deleteRoomTypeSchema,
      tags: ['room-types'],
      summary: 'Delete room type',
      security: [{ bearerAuth: [] }]
    },
    preHandler: [
      fastify.authenticate,
      rbacGuard(permissions.deleteRoomType)
    ]
  }, (request, reply) => roomTypeController.deleteRoomType(request, reply));
}