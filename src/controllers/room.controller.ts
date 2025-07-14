import { FastifyRequest, FastifyReply } from 'fastify';
import { RoomService } from '../services/room.service';
import { z } from 'zod';

const roomFiltersSchema = z.object({
  hotelId: z.string().uuid().optional(),
  status: z.enum(['available', 'occupied', 'maintenance', 'out_of_order']).optional(),
  roomType: z.string().optional(),
  city: z.string().optional(),
  minPrice: z.number().positive().optional(),
  maxPrice: z.number().positive().optional(),
  capacity: z.number().int().positive().optional(),
  isHourlyBooking: z.boolean().optional(),
  isDailyBooking: z.boolean().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(10),
  search: z.string().optional(),
});

const createRoomSchema = z.object({
  hotelId: z.string().uuid(),
  roomNumber: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  capacity: z.number().int().min(1),
  bedType: z.string().optional(),
  size: z.number().positive().optional(),
  floor: z.number().int().optional(),
  pricePerNight: z.number().positive(),
  pricePerHour: z.number().positive().optional(),
  type: z.string().optional(),
  roomTypeId: z.string().uuid().optional(),
  isHourlyBooking: z.union([z.boolean(), z.string()]).optional(),
  isDailyBooking: z.union([z.boolean(), z.string()]).optional(),
  amenities: z.array(z.string()).optional(),
  status: z.enum(['available', 'occupied', 'maintenance', 'out_of_order']).default('available'),
  images: z.array(z.string()).optional(),
});

const updateRoomSchema = createRoomSchema.partial().omit({ hotelId: true });

const roomParamsSchema = z.object({
  id: z.string().uuid(),
});

interface AuthenticatedRequest extends FastifyRequest {
  user: {
    id: string;
    phone: string;
    role: string;
  };
}

export class RoomController {
  private roomService: RoomService;

  constructor() {
    this.roomService = new RoomService();
  }

  setFastify(fastify: any) {
    this.roomService.setFastify(fastify);
  }

  // Get all rooms with advanced filtering (Admin access)
  async getAllRooms(request: FastifyRequest, reply: FastifyReply) {
    try {
      const filters = roomFiltersSchema.parse(request.query);
      const result = await this.roomService.getAllRooms(filters);
      
      return reply.code(200).send({
        success: true,
        data: result,
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
      
      return reply.code(500).send({
        success: false,
        message: error.message || 'Failed to fetch rooms',
      });
    }
  }

  // Get rooms by hotel ID
  async getRoomsByHotel(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { hotelId } = request.query as { hotelId: string };
      
      if (!hotelId) {
        return reply.code(400).send({
          success: false,
          message: 'Hotel ID is required',
        });
      }

      const filters = roomFiltersSchema.parse(request.query);
      const result = await this.roomService.getRoomsByHotelId(hotelId, filters);
      
      return reply.code(200).send({
        success: true,
        data: result,
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
      
      return reply.code(500).send({
        success: false,
        message: error.message || 'Failed to fetch rooms',
      });
    }
  }

  // Get room by ID
  async getRoomById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = roomParamsSchema.parse(request.params);
      const room = await this.roomService.getRoomById(id);
      
      return reply.code(200).send({
        success: true,
        data: { room },
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
        message: error.message || 'Failed to fetch room',
      });
    }
  }

  // Create room
  async createRoom(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      // Handle dynamic frontend data
      const roomData = request.body as any;
      
      // Validate required fields
      if (!roomData.name || !roomData.roomNumber || !roomData.pricePerNight || !roomData.hotelId) {
        return reply.code(400).send({
          success: false,
          message: 'Missing required fields: name, roomNumber, pricePerNight, hotelId',
        });
      }
      
      const processedData = {
        hotelId: roomData.hotelId,
        roomNumber: roomData.roomNumber,
        name: roomData.name,
        description: roomData.description,
        capacity: parseInt(roomData.capacity) || 1,
        bedType: roomData.bedType,
        size: roomData.size ? parseFloat(roomData.size) : undefined,
        floor: roomData.floor ? parseInt(roomData.floor) : undefined,
        pricePerNight: parseFloat(roomData.pricePerNight),
        pricePerHour: roomData.pricePerHour ? parseFloat(roomData.pricePerHour) : undefined,
        type: roomData.type,
        roomTypeId: roomData.roomTypeId,
        isHourlyBooking: roomData.isHourlyBooking,
        isDailyBooking: roomData.isDailyBooking,
        amenities: Array.isArray(roomData.amenities) ? roomData.amenities : [],
        status: roomData.status || 'available',
        images: Array.isArray(roomData.images) ? roomData.images : [],
      };
      
      const userId = request.user?.id;
      const roomId = await this.roomService.createRoom(processedData, userId);
      const room = await this.roomService.getRoomById(roomId);
      
      return reply.code(201).send({
        success: true,
        message: 'Room created successfully',
        data: { room },
      });
    } catch (error) {
      request.log.error(error);
      
      const statusCode = error.statusCode || 500;
      return reply.code(statusCode).send({
        success: false,
        message: error.message || 'Failed to create room',
      });
    }
  }

  // Update room
  async updateRoom(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { id } = roomParamsSchema.parse(request.params);
      const roomData = request.body as any;
      
      const processedData: any = {};
      
      // Only include fields that are provided
      if (roomData.roomNumber !== undefined) processedData.roomNumber = roomData.roomNumber;
      if (roomData.name !== undefined) processedData.name = roomData.name;
      if (roomData.description !== undefined) processedData.description = roomData.description;
      if (roomData.capacity !== undefined) processedData.capacity = parseInt(roomData.capacity);
      if (roomData.bedType !== undefined) processedData.bedType = roomData.bedType;
      if (roomData.size !== undefined) processedData.size = parseFloat(roomData.size);
      if (roomData.floor !== undefined) processedData.floor = parseInt(roomData.floor);
      if (roomData.pricePerNight !== undefined) processedData.pricePerNight = parseFloat(roomData.pricePerNight);
      if (roomData.pricePerHour !== undefined) processedData.pricePerHour = parseFloat(roomData.pricePerHour);
      if (roomData.type !== undefined) processedData.type = roomData.type;
      if (roomData.roomTypeId !== undefined) processedData.roomTypeId = roomData.roomTypeId;
      if (roomData.isHourlyBooking !== undefined) processedData.isHourlyBooking = roomData.isHourlyBooking;
      if (roomData.isDailyBooking !== undefined) processedData.isDailyBooking = roomData.isDailyBooking;
      if (roomData.amenities !== undefined) processedData.amenities = Array.isArray(roomData.amenities) ? roomData.amenities : [];
      if (roomData.status !== undefined) processedData.status = roomData.status;
      if (roomData.images !== undefined) processedData.images = Array.isArray(roomData.images) ? roomData.images : [];
      
      const userId = request.user?.id;
      await this.roomService.updateRoom(id, processedData, userId);
      const room = await this.roomService.getRoomById(id);
      
      return reply.code(200).send({
        success: true,
        message: 'Room updated successfully',
        data: { room },
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
        message: error.message || 'Failed to update room',
      });
    }
  }

  // Delete room
  async deleteRoom(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { id } = roomParamsSchema.parse(request.params);
      const userId = request.user?.id;
      
      await this.roomService.deleteRoom(id, userId);
      
      return reply.code(200).send({
        success: true,
        message: 'Room deleted successfully',
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
        message: error.message || 'Failed to delete room',
      });
    }
  }

  // Get room statistics
  async getRoomStatistics(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { hotelId } = request.query as { hotelId?: string };
      const stats = await this.roomService.getRoomStatistics(hotelId);
      
      return reply.code(200).send({
        success: true,
        data: stats,
      });
    } catch (error) {
      request.log.error(error);
      
      return reply.code(500).send({
        success: false,
        message: error.message || 'Failed to fetch room statistics',
      });
    }
  }
}