import { FastifyInstance } from "fastify";
import { rooms, roomImages, hotels, roomTypes, users } from "../models/schema";
import { eq, and, like, inArray, desc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { uploadToS3 } from "../config/aws";
import { NotFoundError, ConflictError, ForbiddenError } from "../types/errors";

interface RoomCreateParams {
  hotelId: string;
  roomNumber: string;
  name: string;
  description?: string;
  capacity: number;
  bedType?: string;
  size?: number;
  floor?: number;
  pricePerNight: number;
  pricePerHour?: number;
  type?: string;
  roomTypeId?: string;
  isHourlyBooking?: boolean;
  isDailyBooking?: boolean;
  amenities?: string[];
  status?: string;
  images?: string[];
}

interface RoomFilters {
  hotelId?: string;
  status?: string;
  roomType?: string;
  city?: string;
  minPrice?: number;
  maxPrice?: number;
  capacity?: number;
  isHourlyBooking?: boolean;
  isDailyBooking?: boolean;
  page?: number;
  limit?: number;
  search?: string;
}

export class RoomService {
  private fastify!: FastifyInstance;

  setFastify(fastify: FastifyInstance) {
    this.fastify = fastify;
  }

  // Get all rooms with advanced filtering (Admin access)
  async getAllRooms(filters: RoomFilters = {}) {
    const db = this.fastify.db;
    const {
      hotelId,
      status,
      roomType,
      city,
      minPrice,
      maxPrice,
      capacity,
      isHourlyBooking,
      isDailyBooking,
      page = 1,
      limit = 10,
      search
    } = filters;

    let whereConditions: any[] = [];

    // Hotel filter
    if (hotelId) {
      whereConditions.push(eq(rooms.hotelId, hotelId));
    }

    // Status filter
    if (status) {
      whereConditions.push(eq(rooms.status, status));
    }

    // Room type filter
    if (roomType) {
      whereConditions.push(eq(rooms.type, roomType));
    }

    // Price range filter
    if (minPrice) {
      whereConditions.push(`rooms.price_per_night >= ${minPrice}`);
    }
    if (maxPrice) {
      whereConditions.push(`rooms.price_per_night <= ${maxPrice}`);
    }

    // Capacity filter
    if (capacity) {
      whereConditions.push(`rooms.capacity >= ${capacity}`);
    }

    // Booking type filters
    if (isHourlyBooking !== undefined) {
      whereConditions.push(eq(rooms.isHourlyBooking, isHourlyBooking));
    }
    if (isDailyBooking !== undefined) {
      whereConditions.push(eq(rooms.isDailyBooking, isDailyBooking));
    }

    // Search filter (name, room number, hotel name)
    let searchCondition = null;
    if (search) {
      searchCondition = `(rooms.name LIKE '%${search}%' OR rooms.room_number LIKE '%${search}%' OR hotels.name LIKE '%${search}%')`;
    }

    const roomResults = await db.query.rooms.findMany({
      where: whereConditions.length > 0 ? and(...whereConditions) : undefined,
      with: {
        hotel: {
          columns: {
            id: true,
            name: true,
            city: true,
            address: true,
          }
        },
        roomType: true,
        images: {
          orderBy: [desc(roomImages.isPrimary)],
        },
      },
      orderBy: [desc(rooms.createdAt)],
      limit,
      offset: (page - 1) * limit,
    });

    // Apply search filter if needed (since Drizzle doesn't support complex LIKE with joins easily)
    let filteredResults = roomResults;
    if (search) {
      filteredResults = roomResults.filter(room => 
        room.name.toLowerCase().includes(search.toLowerCase()) ||
        room.roomNumber.toLowerCase().includes(search.toLowerCase()) ||
        room.hotel.name.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Apply city filter if needed
    if (city) {
      filteredResults = filteredResults.filter(room => 
        room.hotel.city.toLowerCase().includes(city.toLowerCase())
      );
    }

    // Get total count for pagination
    const totalRooms = await db.query.rooms.findMany({
      where: whereConditions.length > 0 ? and(...whereConditions) : undefined,
      with: {
        hotel: true,
      }
    });

    let totalCount = totalRooms.length;
    if (search || city) {
      totalCount = totalRooms.filter(room => {
        let matches = true;
        if (search) {
          matches = matches && (
            room.name.toLowerCase().includes(search.toLowerCase()) ||
            room.roomNumber.toLowerCase().includes(search.toLowerCase()) ||
            room.hotel.name.toLowerCase().includes(search.toLowerCase())
          );
        }
        if (city) {
          matches = matches && room.hotel.city.toLowerCase().includes(city.toLowerCase());
        }
        return matches;
      }).length;
    }

    return {
      rooms: filteredResults.map(room => this.formatRoomResponse(room)),
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
    };
  }

  // Get rooms by hotel ID
  async getRoomsByHotelId(hotelId: string, filters: Partial<RoomFilters> = {}) {
    return await this.getAllRooms({ ...filters, hotelId });
  }

  // Get room by ID
  async getRoomById(roomId: string) {
    const db = this.fastify.db;

    const room = await db.query.rooms.findFirst({
      where: eq(rooms.id, roomId),
      with: {
        hotel: {
          columns: {
            id: true,
            name: true,
            city: true,
            address: true,
          }
        },
        roomType: true,
        images: {
          orderBy: [desc(roomImages.isPrimary)],
        },
      },
    });

    if (!room) {
      throw new NotFoundError(`Room with id ${roomId} not found`);
    }

    return this.formatRoomResponse(room);
  }

  // Create room
  async createRoom(roomData: RoomCreateParams, userId?: string) {
    const db = this.fastify.db;
    const roomId = uuidv4();

    // Verify hotel exists
    const hotel = await db.query.hotels.findFirst({
      where: eq(hotels.id, roomData.hotelId),
    });

    if (!hotel) {
      throw new NotFoundError(`Hotel with id ${roomData.hotelId} not found`);
    }

    // Check if user has permission to create room for this hotel
    if (userId) {
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });

      if (user?.role === 'hotel' && hotel.ownerId !== userId) {
        throw new ForbiddenError('You can only create rooms for your own hotel');
      }
    }

    // Check for duplicate room number in the same hotel
    const existingRoom = await db.query.rooms.findFirst({
      where: and(
        eq(rooms.hotelId, roomData.hotelId),
        eq(rooms.roomNumber, roomData.roomNumber)
      ),
    });

    if (existingRoom) {
      throw new ConflictError(`Room number ${roomData.roomNumber} already exists in this hotel`);
    }

    return await db.transaction(async (tx) => {
      // Handle image uploads if present
      let imageUrls: string[] = [];
      if (roomData.images && roomData.images.length > 0) {
        imageUrls = await Promise.all(
          roomData.images.map(async (base64Image, index) => {
            if (base64Image.startsWith('data:image/')) {
              const buffer = Buffer.from(base64Image.split(',')[1], 'base64');
              const fileName = `room-${roomId}-${Date.now()}-${index}.jpg`;
              return await uploadToS3(buffer, fileName, 'image/jpeg');
            }
            return base64Image; // If it's already a URL
          })
        );
      }

      // Convert boolean strings to actual booleans
      const isHourlyBooking = roomData.isHourlyBooking === 'Active' || roomData.isHourlyBooking === true;
      const isDailyBooking = roomData.isDailyBooking === 'Active' || roomData.isDailyBooking === true;

      // Create room
      await tx.insert(rooms).values({
        id: roomId,
        hotelId: roomData.hotelId,
        roomNumber: roomData.roomNumber,
        name: roomData.name,
        description: roomData.description,
        roomTypeId: roomData.roomTypeId,
        type: roomData.type,
        maxGuests: roomData.capacity,
        capacity: roomData.capacity,
        bedType: roomData.bedType,
        size: roomData.size,
        floor: roomData.floor,
        pricePerNight: roomData.pricePerNight,
        pricePerHour: roomData.pricePerHour,
        isHourlyBooking,
        isDailyBooking,
        amenities: roomData.amenities ? JSON.stringify(roomData.amenities) : null,
        status: roomData.status || 'available',
      });

      // Create room images if uploaded
      if (imageUrls.length > 0) {
        await Promise.all(
          imageUrls.map(async (url, index) => {
            await tx.insert(roomImages).values({
              id: uuidv4(),
              roomId,
              url,
              isPrimary: index === 0, // First image is primary
            });
          })
        );
      }

      return roomId;
    });
  }

  // Update room
  async updateRoom(roomId: string, roomData: Partial<RoomCreateParams>, userId?: string) {
    const db = this.fastify.db;

    // Check if room exists
    const existingRoom = await this.getRoomById(roomId);

    // Check if user has permission to update this room
    if (userId) {
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });

      if (user?.role === 'hotel') {
        const hotel = await db.query.hotels.findFirst({
          where: eq(hotels.id, existingRoom.hotelId),
        });

        if (hotel?.ownerId !== userId) {
          throw new ForbiddenError('You can only update rooms for your own hotel');
        }
      }
    }

    // Check for duplicate room number if room number is being changed
    if (roomData.roomNumber && roomData.roomNumber !== existingRoom.roomNumber) {
      const duplicateRoom = await db.query.rooms.findFirst({
        where: and(
          eq(rooms.hotelId, existingRoom.hotelId),
          eq(rooms.roomNumber, roomData.roomNumber)
        ),
      });

      if (duplicateRoom) {
        throw new ConflictError(`Room number ${roomData.roomNumber} already exists in this hotel`);
      }
    }

    return await db.transaction(async (tx) => {
      // Handle image uploads if present
      let imageUrls: string[] = [];
      if (roomData.images && roomData.images.length > 0) {
        // Delete existing images
        await tx.delete(roomImages).where(eq(roomImages.roomId, roomId));
        
        imageUrls = await Promise.all(
          roomData.images.map(async (base64Image, index) => {
            if (base64Image.startsWith('data:image/')) {
              const buffer = Buffer.from(base64Image.split(',')[1], 'base64');
              const fileName = `room-${roomId}-${Date.now()}-${index}.jpg`;
              return await uploadToS3(buffer, fileName, 'image/jpeg');
            }
            return base64Image; // If it's already a URL
          })
        );
      }

      // Process data for update
      let processedData: any = { ...roomData };
      
      // Handle amenities
      if (roomData.amenities) {
        processedData.amenities = JSON.stringify(roomData.amenities);
      }
      
      // Handle boolean conversions
      if (roomData.isHourlyBooking !== undefined) {
        processedData.isHourlyBooking = roomData.isHourlyBooking === 'Active' || roomData.isHourlyBooking === true;
      }
      if (roomData.isDailyBooking !== undefined) {
        processedData.isDailyBooking = roomData.isDailyBooking === 'Active' || roomData.isDailyBooking === true;
      }
      
      // Map capacity to maxGuests if provided
      if (roomData.capacity) {
        processedData.maxGuests = roomData.capacity;
      }
      
      // Remove images from processed data as we handle them separately
      delete processedData.images;
      processedData.updatedAt = new Date();

      await tx
        .update(rooms)
        .set(processedData)
        .where(eq(rooms.id, roomId));

      // Create new room images if uploaded
      if (imageUrls.length > 0) {
        await Promise.all(
          imageUrls.map(async (url, index) => {
            await tx.insert(roomImages).values({
              id: uuidv4(),
              roomId,
              url,
              isPrimary: index === 0, // First image is primary
            });
          })
        );
      }

      return roomId;
    });
  }

  // Delete room
  async deleteRoom(roomId: string, userId?: string) {
    const db = this.fastify.db;

    // Check if room exists
    const room = await this.getRoomById(roomId);

    // Check if user has permission to delete this room
    if (userId) {
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });

      if (user?.role === 'hotel') {
        const hotel = await db.query.hotels.findFirst({
          where: eq(hotels.id, room.hotelId),
        });

        if (hotel?.ownerId !== userId) {
          throw new ForbiddenError('You can only delete rooms for your own hotel');
        }
      }
    }

    return await db.transaction(async (tx) => {
      // Delete room images
      await tx.delete(roomImages).where(eq(roomImages.roomId, roomId));

      // Delete room
      await tx.delete(rooms).where(eq(rooms.id, roomId));

      return true;
    });
  }

  // Get room statistics (for analytics)
  async getRoomStatistics(hotelId?: string) {
    const db = this.fastify.db;

    let whereCondition = hotelId ? eq(rooms.hotelId, hotelId) : undefined;

    const stats = await db.query.rooms.findMany({
      where: whereCondition,
      with: {
        hotel: {
          columns: {
            id: true,
            name: true,
            city: true,
          }
        }
      }
    });

    const totalRooms = stats.length;
    const availableRooms = stats.filter(room => room.status === 'available').length;
    const occupiedRooms = stats.filter(room => room.status === 'occupied').length;
    const maintenanceRooms = stats.filter(room => room.status === 'maintenance').length;
    const outOfOrderRooms = stats.filter(room => room.status === 'out_of_order').length;

    const hourlyBookingRooms = stats.filter(room => room.isHourlyBooking).length;
    const dailyBookingRooms = stats.filter(room => room.isDailyBooking).length;

    // Group by city if no specific hotel
    const cityStats = hotelId ? null : stats.reduce((acc, room) => {
      const city = room.hotel.city;
      if (!acc[city]) {
        acc[city] = 0;
      }
      acc[city]++;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalRooms,
      availableRooms,
      occupiedRooms,
      maintenanceRooms,
      outOfOrderRooms,
      hourlyBookingRooms,
      dailyBookingRooms,
      occupancyRate: totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0,
      cityStats,
    };
  }

  // Format room response
  private formatRoomResponse(room: any) {
    return {
      id: room.id,
      hotelId: room.hotelId,
      roomNumber: room.roomNumber,
      name: room.name,
      description: room.description,
      capacity: room.capacity,
      maxGuests: room.maxGuests,
      bedType: room.bedType,
      size: room.size,
      floor: room.floor,
      pricePerNight: room.pricePerNight,
      pricePerHour: room.pricePerHour,
      type: room.type,
      roomTypeId: room.roomTypeId,
      roomType: room.roomType ? {
        id: room.roomType.id,
        name: room.roomType.name,
        description: room.roomType.description,
      } : null,
      isHourlyBooking: room.isHourlyBooking,
      isDailyBooking: room.isDailyBooking,
      amenities: room.amenities ? JSON.parse(room.amenities) : [],
      status: room.status,
      hotel: {
        id: room.hotel.id,
        name: room.hotel.name,
        city: room.hotel.city,
        address: room.hotel.address,
      },
      images: room.images.map((image: any) => ({
        id: image.id,
        url: image.url,
        isPrimary: image.isPrimary,
      })),
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
    };
  }
}