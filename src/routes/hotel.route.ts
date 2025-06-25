import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { HotelController } from "../controllers/hotel.controller";
import {
  hotelSearchSchema,
  createHotelSchema,
  updateHotelSchema,
  createRoomSchema,
  getHotelSchema,
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
        ...createRoomSchema,
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
}
