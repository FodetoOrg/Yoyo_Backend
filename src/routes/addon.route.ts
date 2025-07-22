
import { FastifyInstance, FastifyRequest } from 'fastify';
import { AddonController } from '../controllers/addon.controller';
import {
  createAddonSchema,
  updateAddonSchema,
  getAddonSchema,
  updateRoomAddonsSchema,
} from '../schemas/addon.schema';

export default async function addonRoutes(fastify: FastifyInstance) {
  const addonController = new AddonController(fastify);

  // Create addon
  fastify.post(
    '/hotels/:hotelId/addons',
    {
      schema: {
        ...createAddonSchema,
        tags: ['addons'],
        summary: 'Create a new addon',
        security: [{ bearerAuth: [] }],
      },
      preHandler: [fastify.authenticate],
    },
    async (request: FastifyRequest, reply) => {
      return addonController.createAddon(request as any, reply);
    }
  );

  // Get hotel addons
  fastify.get(
    '/hotels/:hotelId/addons',
    {
      schema: {
        ...getAddonSchema,
        tags: ['addons'],
        summary: 'Get all addons for a hotel',
        security: [{ bearerAuth: [] }],
      },
      preHandler: [fastify.authenticate],
    },
    async (request: FastifyRequest, reply) => {
      return addonController.getHotelAddons(request as any, reply);
    }
  );

  // Get single addon
  fastify.get(
    '/hotels/:hotelId/addons/:addonId',
    {
      schema: {
        ...getAddonSchema,
        tags: ['addons'],
        summary: 'Get a specific addon',
        security: [{ bearerAuth: [] }],
      },
      preHandler: [fastify.authenticate],
    },
    async (request: FastifyRequest, reply) => {
      return addonController.getAddon(request as any, reply);
    }
  );

  // Update addon
  fastify.put(
    '/hotels/:hotelId/addons/:addonId',
    {
      schema: {
        ...updateAddonSchema,
        tags: ['addons'],
        summary: 'Update an addon',
        security: [{ bearerAuth: [] }],
      },
      preHandler: [fastify.authenticate],
    },
    async (request: FastifyRequest, reply) => {
      return addonController.updateAddon(request as any, reply);
    }
  );

  // Delete addon
  fastify.delete(
    '/hotels/:hotelId/addons/:addonId',
    {
      schema: {
        ...getAddonSchema,
        tags: ['addons'],
        summary: 'Delete an addon',
        security: [{ bearerAuth: [] }],
      },
      preHandler: [fastify.authenticate],
    },
    async (request: FastifyRequest, reply) => {
      return addonController.deleteAddon(request as any, reply);
    }
  );

  // Update room addons
  fastify.put(
    '/hotels/:hotelId/rooms/:roomId/addons',
    {
      schema: {
        ...updateRoomAddonsSchema,
        tags: ['addons'],
        summary: 'Update addons for a room',
        security: [{ bearerAuth: [] }],
      },
      preHandler: [fastify.authenticate],
    },
    async (request: FastifyRequest, reply) => {
      return addonController.updateRoomAddons(request as any, reply);
    }
  );

  // Get room addons
  fastify.get(
    '/rooms/:roomId/addons',
    {
      schema: {
        tags: ['addons'],
        summary: 'Get addons for a room',
        security: [{ bearerAuth: [] }],
      },
      preHandler: [fastify.authenticate],
    },
    async (request: FastifyRequest, reply) => {
      return addonController.getRoomAddons(request as any, reply);
    }
  );
}
