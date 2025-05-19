import { FastifyRequest, FastifyReply } from 'fastify';
import { HotelService } from '../services/hotel.service';
import { z } from 'zod';
import {
  hotelSearchSchema,
  createHotelSchema,
  updateHotelSchema,
  createRoomSchema
} from '../schemas/hotel.schema';

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

  async searchHotels(request: FastifyRequest, reply: FastifyReply) {
    try {
      const queryParams = hotelSearchSchema.querystring.parse(request.query);
      const hotels = await this.hotelService.searchHotels(queryParams);
      return reply.code(200).send({
        success: true,
        data: hotels
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          message: 'Validation error',
          errors: error.errors
        });
      }
      throw error;
    }
  }

  async getHotelById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = createHotelSchema.params.parse(request.params);
      const hotel = await this.hotelService.getHotelById(id);
      
      if (!hotel) {
        return reply.code(404).send({
          success: false,
          message: 'Hotel not found'
        });
      }

      return reply.code(200).send({
        success: true,
        data: { hotel }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          message: 'Validation error',
          errors: error.errors
        });
      }
      throw error;
    }
  }

  async createHotel(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const hotelData = createHotelSchema.body.parse(request.body);
      const hotel = await this.hotelService.createHotel({
        ...hotelData,
        ownerId: request.user.id
      });
      return reply.code(201).send({
        success: true,
        message: 'Hotel created successfully',
        data: { hotel }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          message: 'Validation error',
          errors: error.errors
        });
      }
      throw error;
    }
  }

  async updateHotel(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { id } = updateHotelSchema.params.parse(request.params);
      const hotelData = updateHotelSchema.body.parse(request.body);
      const hotel = await this.hotelService.updateHotel(id, hotelData);
      return reply.code(200).send({
        success: true,
        message: 'Hotel updated successfully',
        data: { hotel }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          message: 'Validation error',
          errors: error.errors
        });
      }
      throw error;
    }
  }

  async deleteHotel(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { id } = createHotelSchema.params.parse(request.params);
      await this.hotelService.deleteHotel(id);
      return reply.code(200).send({
        success: true,
        message: 'Hotel deleted successfully'
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          message: 'Validation error',
          errors: error.errors
        });
      }
      throw error;
    }
  }

  async createRoom(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { id: hotelId } = createRoomSchema.params.parse(request.params);
      const roomData = createRoomSchema.body.parse(request.body);
      const room = await this.hotelService.createRoom({
        ...roomData,
        hotelId
      });
      return reply.code(201).send({
        success: true,
        message: 'Room created successfully',
        data: { room }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          message: 'Validation error',
          errors: error.errors
        });
      }
      throw error;
    }
  }
}