// @ts-nocheck
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { HotelController } from "../controllers/hotel.controller";
import {
  hotelSearchSchema,
  createHotelSchema,
  updateHotelSchema,
  createRoomSchema,
  getHotelSchema,
  getHotelDetailsSchema,
  getHotelUsersSchema,
} from "../schemas/hotel.schema";

interface AuthenticatedRequest extends FastifyRequest {
  user: {
    id: string;
    phone: string;
    role: string;
    iat: number;
    exp: number;
  };
}

const hotelController = new HotelController();

export default async function hotelRoutes(fastify: FastifyInstance) {
  // Set fastify instance in the hotel service
  hotelController.setFastify(fastify);

  fastify.get(
    "/",
    {
      schema: {
        tags: ["hotels"],
        summary: "Get all hotels",
      },
      preHandler: [fastify.authenticate],
      // preHandler: [rbacGuard(permissions.viewAllHotels)]
    },
    async (request, reply) => {
      return hotelController.getHotels(request as AuthenticatedRequest, reply);
    }
  );

  fastify.get(
    "/hotelUsers",
    {
      ...getHotelUsersSchema,
      schema: {
        tags: ["hotels"],
        summary: "Get all hotel users",
      },
      // preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      return hotelController.getHotelUsers(
        request ,
        reply
      );
    }
  );

  // Search hotels (public)
  fastify.get(
    "/search",
    {
      schema: {
        ...hotelSearchSchema,
        tags: ["hotels"],
        summary: "Search hotels",
      },
    },
    async (request, reply) => {
      return hotelController.searchHotels(request, reply);
    }
  );

  // Get hotel by ID (public)
  fastify.get(
    "/:id",
    {
      schema: {
        ...getHotelSchema,
        tags: ["hotels"],
        summary: "Get hotel by ID",
      },
      preHandler: [],
    },
    async (request, reply) => {
      return hotelController.getHotelById(request, reply);
    }
  );

  // Get detailed hotel information (public)
  fastify.get(
    "/:id/details",
    {
      schema: {
        ...getHotelDetailsSchema,
        tags: ["hotels"],
        summary: "Get detailed hotel information with room upgrades",
      },
      preHandler: [],
    },
    async (request, reply) => {
      return hotelController.getHotelDetails(request, reply);
    }
  );

  // Create hotel (authenticated)
  fastify.post(
    "/",
    {
      schema: {
        ...createHotelSchema,
        tags: ["hotels"],
        summary: "Create a new hotel",
        security: [{ bearerAuth: [] }],
      },
      preHandler: [
        fastify.authenticate,
        // rbacGuard(permissions.createHotel)
      ],
    },
    async (request: FastifyRequest, reply) => {
      return hotelController.createHotel(
        request as AuthenticatedRequest,
        reply
      );
    }
  );

  // Update hotel (authenticated)
  fastify.put(
    "/:id",
    {
      schema: {
        ...updateHotelSchema,
        tags: ["hotels"],
        summary: "Update hotel details",
        security: [{ bearerAuth: [] }],
      },
      preHandler: [fastify.authenticate],
    },
    async (request: FastifyRequest, reply) => {
      return hotelController.updateHotel(
        request as AuthenticatedRequest,
        reply
      );
    }
  );

  // Delete hotel (authenticated)
  fastify.delete(
    "/:id",
    {
      schema: {
        ...getHotelSchema,
        tags: ["hotels"],
        summary: "Delete hotel",
        security: [{ bearerAuth: [] }],
      },
      preHandler: [fastify.authenticate],
    },
    async (request: FastifyRequest, reply) => {
      return hotelController.deleteHotel(
        request as AuthenticatedRequest,
        reply
      );
    }
  );

  // Create room (authenticated)
  fastify.post(
    "/:id/rooms",
    {
      schema: {
        tags: ["hotels"],
        summary: "Create a new room",
        security: [{ bearerAuth: [] }],
      },
      preHandler: [fastify.authenticate],
    },
    async (request: FastifyRequest, reply) => {
      return hotelController.createRoom(request as AuthenticatedRequest, reply);
    }
  );

  // Update room (authenticated)
  fastify.put(
    "/:id/rooms/:roomId",
    {
      schema: {
        tags: ["hotels"],
        summary: "Update a room",
        security: [{ bearerAuth: [] }],
      },
      preHandler: [fastify.authenticate],
    },
    async (request: FastifyRequest, reply) => {
      return hotelController.updateRoom(request as AuthenticatedRequest, reply);
    }
  );

  // Get rooms by hotel (authenticated)
  fastify.get(
    "/:id/rooms",
    {
      schema: {
        tags: ["hotels"],
        summary: "Get all rooms for a hotel",
        security: [{ bearerAuth: [] }],
      },
      preHandler: [fastify.authenticate],
    },
    async (request: FastifyRequest, reply) => {
      return hotelController.getRoomsByHotel(request as AuthenticatedRequest, reply);
    }
  );

  // Get single room (authenticated)
  fastify.get(
    "/:id/rooms/:roomId",
    {
      schema: {
        tags: ["hotels"],
        summary: "Get a specific room",
        security: [{ bearerAuth: [] }],
      },
      preHandler: [fastify.authenticate],
    },
    async (request: FastifyRequest, reply) => {
      const { roomId } = request.params as { roomId: string };
      const room = await hotelController.hotelService.getRoomById(roomId);
      
      if (!room) {
        return reply.code(404).send({
          success: false,
          message: "Room not found",
        });
      }
      
      return reply.code(200).send({
        success: true,
        data: { room },
      });
    }
  );

  // Delete room (authenticated)
  fastify.delete(
    "/:id/rooms/:roomId",
    {
      schema: {
        tags: ["hotels"],
        summary: "Delete a room",
        security: [{ bearerAuth: [] }],
      },
      preHandler: [fastify.authenticate],
    },
    async (request: FastifyRequest, reply) => {
      const { roomId } = request.params as { roomId: string };
      await hotelController.hotelService.deleteRoom(roomId);
      
      return reply.code(200).send({
        success: true,
        message: "Room deleted successfully",
      });
    }
  );
}
