import { FastifyRequest, FastifyReply } from "fastify";
import { HotelService } from "../services/hotel.service";
import { z } from "zod";
import {
  CreateHotelBodySchema,
  UpdateHotelBodySchema,
  GetHotelParamsSchema,
  CreateRoomBodySchema,
  HotelSearchQuerySchema
} from "../schemas/hotel.schema";
import { uploadToS3 } from "../config/aws";
import { randomUUID } from "crypto";

interface AuthenticatedRequest extends FastifyRequest {
  user: {
    id: string;
    phone: string;
    role: string;
    iat: number;
    exp: number;
  };
}

export class HotelController {
  private hotelService: HotelService;

  constructor() {
    this.hotelService = new HotelService();
  }

  setFastify(fastify: any) {
    this.hotelService.setFastify(fastify);
  }

  async getHotels(request: FastifyRequest, reply: FastifyReply) {
    console.log("getHotels ",request.user);
    const hotels = await this.hotelService.getHotels();
    return reply.code(200).send({
      success: true,
      data: hotels,
    });
  }

  async searchHotels(request: FastifyRequest, reply: FastifyReply) {
    try {
      const queryParams = HotelSearchQuerySchema.parse(request.query);
      const hotels = await this.hotelService.searchHotels(queryParams);
      return reply.code(200).send({
        success: true,
        data: hotels,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          message: "Validation error",
          errors: error.errors,
        });
      }
      throw error;
    }
  }

  async getHotelById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = GetHotelParamsSchema.parse(request.params);
      const hotel = await this.hotelService.getHotelById(id);

      if (!hotel) {
        return reply.code(404).send({
          success: false,
          message: "Hotel not found",
        });
      }

      return reply.code(200).send({
        success: true,
        data: { hotel },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          message: "Validation error",
          errors: error.errors,
        });
      }
      throw error;
    }
  }

  async createHotel(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const hotelData = CreateHotelBodySchema.parse(request.body);
      
      // Handle image uploads if present
      let imageUrls: string[] = [];
      if (hotelData.images && hotelData.images.length > 0) {
        imageUrls = await Promise.all(
          hotelData.images.map(async (base64Image) => {
            const buffer = Buffer.from(base64Image.split(',')[1], 'base64');
            return await uploadToS3(buffer, 'image.jpg', 'image/jpeg');
          })
        );
      }

      // Create hotel with image URLs
      const hotel = await this.hotelService.createHotel({
        ...hotelData,
      });

      return reply.code(201).send({
        success: true,
        message: "Hotel created successfully",
        data: { hotel },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          message: "Validation error",
          errors: error.errors,
        });
      }
      throw error;
    }
  }

  async updateHotel(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { id } = GetHotelParamsSchema.parse(request.params);
      const hotelData = UpdateHotelBodySchema.parse(request.body);
      const hotel = await this.hotelService.updateHotel(id, hotelData);
      return reply.code(200).send({
        success: true,
        message: "Hotel updated successfully",
        data: { hotel },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          message: "Validation error",
          errors: error.errors,
        });
      }
      throw error;
    }
  }

  async deleteHotel(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { id } = GetHotelParamsSchema.parse(request.params);
      await this.hotelService.deleteHotel(id);
      return reply.code(200).send({
        success: true,
        message: "Hotel deleted successfully",
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          message: "Validation error",
          errors: error.errors,
        });
      }
      throw error;
    }
  }

  async createRoom(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { id: hotelId } = GetHotelParamsSchema.parse(request.params);
      const roomData = CreateRoomBodySchema.parse(request.body);
      const room = await this.hotelService.createRoom({
        ...roomData,
        hotelId,
      });
      return reply.code(201).send({
        success: true,
        message: "Room created successfully",
        data: { room },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          message: "Validation error",
          errors: error.errors,
        });
      }
      throw error;
    }
  }

  async getHotelUsers(request: FastifyRequest, reply: FastifyReply) {
    const {hotelId} = request.query;
    const hotelUsers = await this.hotelService.getHotelUsers(hotelId);
    return reply.code(200).send({
      success: true,
      data: hotelUsers,
    });
  }
}
