import { FastifyInstance, FastifyRequest } from 'fastify';
import { AddonController } from '../controllers/addon.controller';
import {
  createAddonSchema,
  updateAddonSchema,
  getAddonSchema,
  updateRoomAddonsSchema,
} from '../schemas/addon.schema';
import z from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';

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

  // Delete a
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

  // Add addons to room (separate endpoint for mapping)
  fastify.post(
    '/hotels/:hotelId/rooms/:roomId/addons',
    {
      schema: {
        ...updateRoomAddonsSchema,
        tags: ['room-addons'],
        summary: 'Add addons to a room',
        security: [{ bearerAuth: [] }],
      },
      preHandler: [fastify.authenticate],
    },
    async (request: FastifyRequest, reply) => {
      return addonController.addRoomAddons(request as any, reply);
    }
  );

  // Update room addons (replace all mappings)
  fastify.put(
    '/hotels/:hotelId/rooms/:roomId/addons',
    {
      schema: {
        ...updateRoomAddonsSchema,
        tags: ['room-addons'],
        summary: 'Update all addons for a room',
        security: [{ bearerAuth: [] }],
      },
      preHandler: [fastify.authenticate],
    },
    async (request: FastifyRequest, reply) => {
      return addonController.updateRoomAddons(request as any, reply);
    }
  );

  // Remove specific addon from room
  fastify.delete(
    '/hotels/:hotelId/rooms/:roomId/addons/:addonId',
    {
      schema: {
        tags: ['room-addons'],
        summary: 'Remove specific addon from room',
        security: [{ bearerAuth: [] }],
        params: zodToJsonSchema(z.object({
          hotelId: z.string(),
          roomId: z.string(),
          addonId: z.string(),
        })),
      },
      preHandler: [fastify.authenticate],
    },
    async (request: FastifyRequest, reply) => {
      return addonController.removeRoomAddon(request as any, reply);
    }
  );

  // Get room addons
  fastify.get(
    '/rooms/:roomId/addons',
    {
      schema: {
        tags: ['room-addons'],
        summary: 'Get addons for a room',
        security: [{ bearerAuth: [] }],
        params: zodToJsonSchema(z.object({
          roomId: z.string(),
        })),
      },
      preHandler: [fastify.authenticate],
    },
    async (request: FastifyRequest, reply) => {
      return addonController.getRoomAddons(request as any, reply);
    }
  );

  // Get available addons for a room (hotel's addons not yet mapped to this room)
  fastify.get(
    '/hotels/:hotelId/rooms/:roomId/available-addons',
    {
      schema: {
        tags: ['room-addons'],
        summary: 'Get available addons for a room',
        security: [{ bearerAuth: [] }],
        params: zodToJsonSchema(z.object({
          hotelId: z.string(),
          roomId: z.string(),
        })),
      },
      preHandler: [fastify.authenticate],
    },
    async (request: FastifyRequest, reply) => {
      return addonController.getAvailableRoomAddons(request as any, reply);
    }
  );
}