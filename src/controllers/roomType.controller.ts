import { FastifyRequest, FastifyReply } from 'fastify';
import { RoomTypeService } from '../services/roomType.service';
import { z } from 'zod';

const createRoomTypeSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(['active', 'inactive']).default('active'),
});

const updateRoomTypeSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

const roomTypeParamsSchema = z.object({
  id: z.string().uuid(),
});

export class RoomTypeController {
  private roomTypeService: RoomTypeService;

  constructor() {
    this.roomTypeService = new RoomTypeService();
  }

  setFastify(fastify: any) {
    this.roomTypeService.setFastify(fastify);
  }

  // Get all room types
  async getRoomTypes(request: FastifyRequest, reply: FastifyReply) {
    try {
      const roomTypes = await this.roomTypeService.getRoomTypes();
      
      return reply.code(200).send({
        success: true,
        data: roomTypes,
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        message: error.message || 'Failed to fetch room types',
      });
    }
  }

  // Get room type by ID
  async getRoomTypeById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = roomTypeParamsSchema.parse(request.params);
      const roomType = await this.roomTypeService.getRoomTypeById(id);
      
      return reply.code(200).send({
        success: true,
        data: roomType,
      });
    } catch (error) {
      request.log.error(error);
      
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
      }
      
      const statusCode = error.statusCode || 500;
      return reply.code(statusCode).send({
        success: false,
        message: error.message || 'Failed to fetch room type',
      });
    }
  }

  // Create room type
  async createRoomType(request: FastifyRequest, reply: FastifyReply) {
    try {
      const roomTypeData = createRoomTypeSchema.parse(request.body);
      const roomType = await this.roomTypeService.createRoomType(roomTypeData);
      
      return reply.code(201).send({
        success: true,
        message: 'Room type created successfully',
        data: roomType,
      });
    } catch (error) {
      request.log.error(error);
      
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
      }
      
      const statusCode = error.statusCode || 500;
      return reply.code(statusCode).send({
        success: false,
        message: error.message || 'Failed to create room type',
      });
    }
  }

  // Update room type
  async updateRoomType(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = roomTypeParamsSchema.parse(request.params);
      const roomTypeData = updateRoomTypeSchema.parse(request.body);
      
      const roomType = await this.roomTypeService.updateRoomType(id, roomTypeData);
      
      return reply.code(200).send({
        success: true,
        message: 'Room type updated successfully',
        data: roomType,
      });
    } catch (error) {
      request.log.error(error);
      
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
      }
      
      const statusCode = error.statusCode || 500;
      return reply.code(statusCode).send({
        success: false,
        message: error.message || 'Failed to update room type',
      });
    }
  }

  // Delete room type
  async deleteRoomType(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = roomTypeParamsSchema.parse(request.params);
      await this.roomTypeService.deleteRoomType(id);
      
      return reply.code(200).send({
        success: true,
        message: 'Room type deleted successfully',
      });
    } catch (error) {
      request.log.error(error);
      
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
      }
      
      const statusCode = error.statusCode || 500;
      return reply.code(statusCode).send({
        success: false,
        message: error.message || 'Failed to delete room type',
      });
    }
  }
}