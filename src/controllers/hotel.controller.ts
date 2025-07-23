// @ts-nocheck
import { FastifyRequest, FastifyReply } from "fastify";
import { HotelService } from "../services/hotel.service";
import { z } from "zod";
import {
  CreateHotelBodySchema,
  UpdateHotelBodySchema,
  GetHotelParamsSchema,
  getHotelDetailsQuerySchema,
  CreateRoomBodySchema,
  HotelSearchQuerySchema
} from "../schemas/hotel.schema";
import { uploadToS3 } from "../config/aws";
import { ForbiddenError } from "../types/errors";

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

  async getHotelDetails(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = GetHotelParamsSchema.parse(request.params);
      const queryParams = request.query as any;
      const { guests, checkIn, checkOut, bookingType } = getHotelDetailsQuerySchema.parse(queryParams);
      
      const hotel = await this.hotelService.getHotelById(id);

      if (!hotel) {
        return reply.code(404).send({
          success: false,
          message: "Hotel not found",
        });
      }

      // Get reviews data
      const reviewsData = await this.hotelService.getHotelReviews(id);
      
      // Get all rooms for the hotel
      let rooms = await this.hotelService.getRoomsByHotelIdEnhanced(id);
      
      // Filter rooms by booking type
      if (bookingType === "daily") {
        rooms = rooms.filter(room => room.isDailyBooking === true);
      } else if (bookingType === "hourly") {
        rooms = rooms.filter(room => room.isHourlyBooking === true);
      }
      
      // Filter rooms by guest capacity if provided
      if (guests && guests > 0) {
        rooms = rooms.filter(room => room.capacity >= guests);
      }
      
      // If dates are provided, filter by availability
      if (checkIn && checkOut && rooms.length > 0) {
        const checkInDate = new Date(checkIn);
        const checkOutDate = new Date(checkOut);
        
        const availableRooms = [];
        for (const room of rooms) {
          const isAvailable = await this.hotelService.checkRoomAvailability(room.id, checkInDate, checkOutDate);
          if (isAvailable) {
            availableRooms.push(room);
          }
        }
        rooms = availableRooms;
      }
      
      // Sort available rooms by price (ascending order - cheapest first)
      // Use appropriate price based on booking type
      const sortedRooms = rooms.sort((a, b) => {
        const priceA = bookingType === "hourly" ? (a.pricePerHour || a.pricePerNight) : a.pricePerNight;
        const priceB = bookingType === "hourly" ? (b.pricePerHour || b.pricePerNight) : b.pricePerNight;
        return priceA - priceB;
      });
      
      // Get room addons for each room
      const roomsWithAddons = await Promise.all(
        sortedRooms.map(async (room) => {
          const roomAddons = await this.hotelService.getRoomAddons(room.id);
          return {
            ...room,
            addons: roomAddons
          };
        })
      );
      
      // Create room upgrade data structure - only if there are available rooms
      const roomUpgradeData = {
        currentRoom: roomsWithAddons.length > 0 ? {
          id: roomsWithAddons[0].id,
          name: roomsWithAddons[0].name,
          image: roomsWithAddons[0].images.length > 0 ? roomsWithAddons[0].images[0].url : null,
          features: roomsWithAddons[0].description || roomsWithAddons[0].amenities.join(', '),
          pricePerNight: roomsWithAddons[0].pricePerNight,
          pricePerHour: roomsWithAddons[0].pricePerHour,
          capacity: roomsWithAddons[0].capacity,
          addons: roomsWithAddons[0].addons,
          isCurrent: true,
          bookingType: bookingType,
          displayPrice: bookingType === "hourly" ? (roomsWithAddons[0].pricePerHour || roomsWithAddons[0].pricePerNight) : roomsWithAddons[0].pricePerNight
        } : null,
        upgradeOptions: roomsWithAddons.slice(1).map(room => ({
          id: room.id,
          name: room.name,
          image: room.images.length > 0 ? room.images[0].url : null,
          features: room.description || room.amenities.join(', '),
          pricePerNight: room.pricePerNight,
          pricePerHour: room.pricePerHour,
          capacity: room.capacity,
          addons: room.addons,
          bookingType: bookingType,
          displayPrice: bookingType === "hourly" ? (room.pricePerHour || room.pricePerNight) : room.pricePerNight
        })),
        totalAvailableRooms: roomsWithAddons.length
      };

      return reply.code(200).send({
        success: true,
        data: { 
          hotel: {
            ...hotel,
            rating: reviewsData.overallRating,
            reviewCount: reviewsData.totalReviews,
            price: roomsWithAddons.length > 0 ? (bookingType === "hourly" ? (roomsWithAddons[0].pricePerHour || roomsWithAddons[0].pricePerNight) : roomsWithAddons[0].pricePerNight) : null,
            availableRooms: roomsWithAddons.length,
            reviewsData,
            roomUpgradeData,
            searchCriteria: {
              guests,
              checkIn,
              checkOut,
              bookingType
            }
          }
        },
      });
    } catch (error) {
      request.log.error(error);
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

    
      hotelData.images = imageUrls;

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
      // throw new ForbiddenError("dont have accesss");
      const { id } = GetHotelParamsSchema.parse(request.params);
      console.log('request.body ',request.body)
      // const hotelData = UpdateHotelBodySchema.parse(request.body);
      const hotel = await this.hotelService.updateHotel(id, request.body);
      return reply.code(200).send({
        success: true,
        message: "Hotel updated successfully",
        data: { hotel },
      });
    } catch (error) {
      console.log('error ',error)
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
      const roomData = request.body as any; // Handle dynamic frontend data
      
      // Validate required fields
      if (!roomData.name || !roomData.roomNumber || !roomData.pricePerNight) {
        return reply.code(400).send({
          success: false,
          message: 'Missing required fields: name, roomNumber, pricePerNight',
        });
      }
      
      const room = await this.hotelService.createRoom({
        hotelId,
        roomNumber: roomData.roomNumber,
        name: roomData.name,
        description: roomData.description,
        capacity: parseInt(roomData.capacity) || 1,
        bedType: roomData.bedType,
        size: parseFloat(roomData.size),
        floor: parseInt(roomData.floor),
        pricePerNight: parseFloat(roomData.pricePerNight),
        pricePerHour: roomData.pricePerHour ? parseFloat(roomData.pricePerHour) : undefined,
        type: roomData.type,
        roomTypeId: roomData.roomTypeId,
        isHourlyBooking: roomData.isHourlyBooking,
        isDailyBooking: roomData.isDailyBooking,
        amenities: Array.isArray(roomData.amenities) ? roomData.amenities : [],
        status: roomData.status || 'available',
        images: Array.isArray(roomData.images) ? roomData.images : [],
      });
      
      return reply.code(201).send({
        success: true,
        message: "Room created successfully",
        data: { room },
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        message: error.message || "Failed to create room",
      });
    }
  }

  async updateRoom(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { id: hotelId } = GetHotelParamsSchema.parse(request.params);
      const { roomId } = request.params as { roomId: string };
      const roomData = request.body as any; // Handle dynamic frontend data
      
      const room = await this.hotelService.getUpdatedRoom(roomId, {
        hotelId,
        roomNumber: roomData.roomNumber,
        name: roomData.name,
        description: roomData.description,
        capacity: roomData.capacity ? parseInt(roomData.capacity) : undefined,
        bedType: roomData.bedType,
        size: roomData.size ? parseFloat(roomData.size) : undefined,
        floor: roomData.floor ? parseInt(roomData.floor) : undefined,
        pricePerNight: roomData.pricePerNight ? parseFloat(roomData.pricePerNight) : undefined,
        pricePerHour: roomData.pricePerHour ? parseFloat(roomData.pricePerHour) : undefined,
        type: roomData.type,
        roomTypeId: roomData.roomTypeId,
        isHourlyBooking: roomData.isHourlyBooking,
        isDailyBooking: roomData.isDailyBooking,
        amenities: Array.isArray(roomData.amenities) ? roomData.amenities : undefined,
        status: roomData.status,
        images: Array.isArray(roomData.images) ? roomData.images : undefined,
      });
      
      return reply.code(200).send({
        success: true,
        message: "Room updated successfully",
        data: { room },
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        message: error.message || "Failed to update room",
      });
    }
  }

  async getRoomsByHotel(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { id: hotelId } = GetHotelParamsSchema.parse(request.params);
      const rooms = await this.hotelService.getRoomsByHotelIdEnhanced(hotelId);
      
      return reply.code(200).send({
        success: true,
        data: { rooms },
      });
    } catch (error) {
      request.log.error(error);
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
