import { FastifyInstance } from "fastify";
import {
  hotels,
  rooms,
  hotelImages,
  roomImages,
  users,
  hotelUsers,
  cities,
  hotelCities,
  Hotel,
  hotelReviews,
  bookings,
  bookings,
} from "../models/schema";
import { v4 as uuidv4 } from "uuid";
import { eq, and, like, inArray, exists, not, isNull, desc, or, sql } from "drizzle-orm";
import { UserRole } from "../types/common";
import { ForbiddenError } from "../types/errors";
import { uploadToS3 } from "../config/aws";

interface HotelSearchParams {
  city: string;
  checkIn?: string;
  checkOut?: string;
  guests: number;
  rooms: number;
  bookingType?: "daily" | "hourly";
}

interface HotelCreateParams {
  name: string;
  description?: string;
  address: string;
  cityId: string;
  zipCode?: string;
  starRating?: string;
  amenities?: string[];
  ownerId: string;
  images?: string[];
  mapCoordinates: string;
  paymentMode?: 'online' | 'offline' | 'both';
  onlinePaymentEnabled?: boolean;
  offlinePaymentEnabled?: boolean;
}

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

export class HotelService {
  private fastify!: FastifyInstance;

  // Method to set Fastify instance
  setFastify(fastify: FastifyInstance) {
    this.fastify = fastify;
  }

  async getHotels() {
    const db = this.fastify.db;
    const hotels = await db.query.hotels.findMany();
    return hotels;
  }

  // Search hotels by city and other criteria
  async searchHotels(params: HotelSearchParams) {
    const db = this.fastify.db;
    const { city } = params;

    // Query for hotels
    const hotelResults = await db.query.hotels.findMany({
      where: like(hotels.city, `%${city}%`),
      with: {
        images: {
          where: eq(hotelImages.isPrimary, true),
        },
      },
    });

    // Format hotel results
    const formattedHotels = hotelResults.map((hotel) => ({
      id: hotel.id,
      name: hotel.name,
      description: hotel.description,
      address: hotel.address,
      city: hotel.city,
      state: hotel.state,
      country: hotel.country,
      zipCode: hotel.zipCode,
      starRating: hotel.starRating,
      amenities: hotel.amenities ? JSON.parse(hotel.amenities) : [],
      image: hotel.images.length > 0 ? hotel.images[0].url : null,
    }));

    return formattedHotels;
  }

  // Get hotel by ID
  async getHotelById(id: string) {
    const db = this.fastify.db;

    const hotel = await db.query.hotels.findFirst({
      where: eq(hotels.id, id),
      with: {
        images: true,
        city: true,
      },
    });

    if (!hotel) {
      return null;
    }

    // Format hotel data
    return {
      id: hotel.id,
      name: hotel.name,
      description: hotel.description,
      address: hotel.address,
      city: hotel.city,
      state: hotel.state,
      country: hotel.country,
      zipCode: hotel.zipCode,
      starRating: hotel.starRating,
      amenities: hotel.amenities ? JSON.parse(hotel.amenities) : [],
      ownerId: hotel.ownerId,
      paymentMode: hotel.paymentMode,
      onlinePaymentEnabled: hotel.onlinePaymentEnabled,
      offlinePaymentEnabled: hotel.offlinePaymentEnabled,
      createdAt: hotel.createdAt,
      updatedAt: hotel.updatedAt,
      cityId: hotel.city ? hotel.city.cityId : null,
      mapCoordinates: hotel.mapCoordinates,
      images: hotel.images.map((image) => ({
        id: image.id,
        url: image.url,
        isPrimary: image.isPrimary,
      })),
    };
  }

  // Create a new hotel
  async createHotel(hotelData: HotelCreateParams) {
    const db = this.fastify.db;
    const hotelId = uuidv4();

    console.log("hotelData", hotelData);
    // Start a transaction
    return await db.transaction(async (tx) => {
      // check if hotel owner exists
      const hotelOwner = await tx.query.hotelUsers.findFirst({
        where: eq(hotelUsers.userId, hotelData.ownerId),
      });

      console.log("hotelOwner in createHotel", hotelOwner);

      if (hotelOwner) {
        throw new ForbiddenError("Hotel owner not found");
      }

      // check if hotel city exists
      const hotelCity = await tx.query.cities.findFirst({
        where: eq(cities.id, hotelData.cityId),
      });

      if (!hotelCity) {
        throw new ForbiddenError("Hotel city not found");
      }

      // Create hotel
      await tx.insert(hotels).values({
        id: hotelId,
        name: hotelData.name,
        description: hotelData.description,
        address: hotelData.address,
        city: hotelCity.name,
        country: hotelCity.country,
        zipCode: hotelData.zipCode,
        starRating: hotelData.starRating,
        amenities: hotelData.amenities
          ? JSON.stringify(hotelData.amenities)
          : null,
        ownerId: hotelData.ownerId,
        mapCoordinates: hotelData.mapCoordinates,
        paymentMode: hotelData.paymentMode || 'offline',
        onlinePaymentEnabled: hotelData.onlinePaymentEnabled || false,
        offlinePaymentEnabled: hotelData.offlinePaymentEnabled !== false, // Default true
      });

      // add hotel city to hotel
      await tx.insert(hotelCities).values({
        id: uuidv4(),
        hotelId,
        cityId: hotelData.cityId,
      });

      // add hotel owner to hotel
      await tx.insert(hotelUsers).values({
        id: uuidv4(),
        hotelId,
        userId: hotelData.ownerId,
      });
      // Create hotel images if provided
      if (hotelData.images && hotelData.images.length > 0) {
        await tx.insert(hotelImages).values(
          hotelData.images.map((image) => ({
            id: uuidv4(),
            hotelId,
            url: image,
            isPrimary: false,
          }))
        );
      }

      // Get the created hotel
      const hotel = await this.getHotelById(hotelId);
      return hotel;
    });
  }

  // Update hotel details
  async updateHotel(hotelId: string, hotelData) {
    const db = this.fastify.db;

    // Process amenities if provided
    let processedData: any = { ...hotelData };
    if (hotelData.amenities) {
      processedData.amenities = JSON.stringify(hotelData.amenities);
    }

    return await db.transaction(async (tx) => {
      const existingData: Hotel = await tx.query.hotel.findFirst({
        where: eq(hotels.id, hotelData.id),
      });

      if (!existingData) {
        throw new ForbiddenError("Hotel not found");
      }

      const hotelOwner = await tx.query.hotelUsers.findFirst({
        where: eq(hotelUsers.userId, hotelData.ownerId),
      });

      if (hotelOwner) {
        throw new ForbiddenError("Hotel owner already assigned to other hotel");
      }

      // check if hotel city exists
      const hotelCity = await tx.query.cities.findFirst({
        where: eq(cities.id, hotelData.cityId),
      });

      if (!hotelCity) {
        throw new ForbiddenError("Hotel city not found");
      }

      if (existingData.ownerId !== hotelData.ownerId) {
        await tx
          .delete(hotelUsers)
          .where(eq(hotelUsers.hotelId, existingData.ownerId));

        await tx.insert(hotelUsers).values({
          hotelId: hotelData.id,
          userId: hotelData.ownerId,
          id: uuidv4(),
        });
      }

      const existingCity = await tx.query.hotelCities.findFirst({
        where: eq(hotelCities.hotelId, hotelData.id),
      });

      if (existingCity.cityId !== hotelData.cityId) {
        await tx
          .delete(hotelCities)
          .where(eq(hotelCities.cityId, existingCity.cityId));

        await tx.insert(hotelCities).values({
          hotelId: hotelData.id,
          cityId: hotelData.cityId,
          id: uuidv4(),
        });
      }

      await db
        .update(hotels)
        .set({
          ...processedData,
          updatedAt: new Date(),
        })
        .where(eq(hotels.id, hotelId));
      const hotel = await this.getHotelById(hotelId);
      return hotel;
    });

    // Get the updated hotel
  }

  // Delete a hotel
  async deleteHotel(hotelId: string) {
    const db = this.fastify.db;

    // First, delete all rooms associated with this hotel
    const hotelRooms = await db.query.rooms.findMany({
      where: eq(rooms.hotelId, hotelId),
    });

    if (hotelRooms.length > 0) {
      const roomIds = hotelRooms.map((room) => room.id);

      // Delete room images
      await db.delete(roomImages).where(inArray(roomImages.roomId, roomIds));

      // Delete rooms
      await db.delete(rooms).where(inArray(rooms.id, roomIds));
    }

    // Delete hotel images
    await db.delete(hotelImages).where(eq(hotelImages.hotelId, hotelId));

    // Delete hotel
    await db.delete(hotels).where(eq(hotels.id, hotelId));

    return true;
  }

  // Create a new room for a hotel
  async createRoom(roomData: RoomCreateParams) {
    const db = this.fastify.db;
    const roomId = uuidv4();

    // Handle image uploads if present
    let imageUrls: string[] = [];
    if (roomData.images && roomData.images.length > 0) {
      imageUrls = await Promise.all(
        roomData.images.map(async (base64Image) => {
          // Check if it's base64 data
          if (base64Image.startsWith('data:image/')) {
            const buffer = Buffer.from(base64Image.split(',')[1], 'base64');
            return await uploadToS3(buffer, `room-${roomId}-${Date.now()}.jpg`, 'image/jpeg');
          }
          return base64Image; // If it's already a URL
        })
      );
    }

    // Convert boolean strings to actual booleans
    const isHourlyBooking = roomData.isHourlyBooking === 'Active' || roomData.isHourlyBooking === true;
    const isDailyBooking = roomData.isDailyBooking === 'Active' || roomData.isDailyBooking === true;

    await db.insert(rooms).values({
      id: roomId,
      hotelId: roomData.hotelId,
      roomNumber: roomData.roomNumber,
      name: roomData.name,
      description: roomData.description,
      roomTypeId: roomData.roomTypeId,
      type: roomData.type,
      maxGuests: roomData.capacity, // Map capacity to maxGuests
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
          await db.insert(roomImages).values({
            id: uuidv4(),
            roomId,
            url,
            isPrimary: index === 0, // First image is primary
          });
        })
      );
    }

    // Get the created room
    const room = await this.getRoomById(roomId);
    return room;
  }

  // Get room by ID
  async getRoomById(roomId: string) {
    const db = this.fastify.db;

    const room = await db.query.rooms.findFirst({
      where: eq(rooms.id, roomId),
      with: {
        images: true,
        roomType: true,
      },
    });

    if (!room) {
      return null;
    }

    // Format room data
    return {
      id: room.id,
      hotelId: room.hotelId,
      roomNumber: room.roomNumber,
      name: room.name,
      description: room.description,
      capacity: room.capacity,
      maxGuests: room.maxGuests, // Keep for backward compatibility
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
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
      images: room.images.map((image) => ({
        id: image.id,
        url: image.url,
        isPrimary: image.isPrimary,
      })),
    };
  }

  // Get all rooms for a hotel
  async getRoomsByHotelId(hotelId: string) {
    const db = this.fastify.db;

    const roomResults = await db.query.rooms.findMany({
      where: eq(rooms.hotelId, hotelId),
      with: {
        images: {
          where: eq(roomImages.isPrimary, true),
        },
      },
    });

    // Format room results
    const formattedRooms = roomResults.map((room) => ({
      id: room.id,
      hotelId: room.hotelId,
      name: room.name,
      description: room.description,
      maxGuests: room.maxGuests,
      pricePerNight: room.pricePerNight,
      pricePerHour: room.pricePerHour,
      roomType: room.roomType,
      amenities: room.amenities ? JSON.parse(room.amenities) : [],
      available: room.available,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
      image: room.images.length > 0 ? room.images[0].url : null,
    }));

    return formattedRooms;
  }

  // Get hotel reviews with rating breakdown
  async getHotelReviews(hotelId: string) {
    const db = this.fastify.db;
    
    // Get all reviews for this hotel
    const reviews = await db.query.hotelReviews.findMany({
      where: and(
        eq(hotelReviews.hotelId, hotelId),
        eq(hotelReviews.isApproved, true)
      ),
      with: {
        user: {
          columns: {
            id: true,
            name: true,
          }
        }
      },
      orderBy: [desc(hotelReviews.createdAt)],
      limit: 10, // Limit to most recent 10 reviews
    });
    
    // Calculate overall rating
    const totalReviews = reviews.length;
    const overallRating = totalReviews > 0 
      ? reviews.reduce((sum, review) => sum + review.overallRating, 0) / totalReviews 
      : 0;
    
    // Calculate rating breakdown
    const ratingBreakdown = {
      '5': 0,
      '4': 0,
      '3': 0,
      '2': 0,
      '1': 0
    };
    
    reviews.forEach(review => {
      const rating = Math.round(review.overallRating);
      if (rating >= 1 && rating <= 5) {
        ratingBreakdown[rating.toString()]++;
      }
    });
    
    // Format reviews for response
    const formattedReviews = reviews.map(review => ({
      id: review.id,
      user: review.user.name || 'Anonymous',
      comment: review.comment || '',
      rating: review.overallRating,
      date: new Date(review.createdAt).toISOString().split('T')[0]
    }));
    
    return {
      overallRating: Math.round(overallRating * 10) / 10,
      totalReviews,
      ratingBreakdown,
      reviews: formattedReviews
    };
  }

  // Update room details
  async updateRoom(roomId: string, roomData: Partial<RoomCreateParams>) {
    const db = this.fastify.db;

    return await db.transaction(async (tx) => {
      // Handle image uploads if present
      let imageUrls: string[] = [];
      if (roomData.images && roomData.images.length > 0) {
        // Delete existing images
        await tx.delete(roomImages).where(eq(roomImages.roomId, roomId));
        
        imageUrls = await Promise.all(
          roomData.images.map(async (base64Image) => {
            // Check if it's base64 data
            if (base64Image.startsWith('data:image/')) {
              const buffer = Buffer.from(base64Image.split(',')[1], 'base64');
              return await uploadToS3(buffer, `room-${roomId}-${Date.now()}.jpg`, 'image/jpeg');
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

  // Get updated room after update
  async getUpdatedRoom(roomId: string, roomData: Partial<RoomCreateParams>) {
    await this.updateRoom(roomId, roomData);
    return await this.getRoomById(roomId);
  }

  // Get rooms by hotel ID with enhanced data
  async getRoomsByHotelIdEnhanced(hotelId: string) {
    const db = this.fastify.db;

    const roomResults = await db.query.rooms.findMany({
      where: eq(rooms.hotelId, hotelId),
      with: {
        images: true,
        roomType: true,
      },
      orderBy: [rooms.roomNumber, rooms.name],
    });

    // Format room results
    return roomResults.map((room) => ({
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
      } : null,
      isHourlyBooking: room.isHourlyBooking,
      isDailyBooking: room.isDailyBooking,
      amenities: room.amenities ? JSON.parse(room.amenities) : [],
      status: room.status,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
      images: room.images.map((image) => ({
        id: image.id,
        url: image.url,
        isPrimary: image.isPrimary,
      })),
    }));
  }

  // Delete a room
  async deleteRoom(roomId: string) {
    const db = this.fastify.db;

    // Delete room images
    await db.delete(roomImages).where(eq(roomImages.roomId, roomId));

    // Delete room
    await db.delete(rooms).where(eq(rooms.id, roomId));

    return true;
  }

  // Check room availability for specific dates
  async checkRoomAvailability(roomId: string, checkInDate: Date, checkOutDate: Date): Promise<boolean> {
    const db = this.fastify.db;
    
    // Get room from database
    const room = await db.query.rooms.findFirst({
      where: eq(rooms.id, roomId)
    });
    
    if (!room || room.status !== 'available') {
      return false;
    }
    
    // Check for overlapping bookings that are not cancelled
    const overlappingBookings = await db.query.bookings.findMany({
      where: and(
        eq(bookings.roomId, roomId),
        not(eq(bookings.status, 'cancelled')),
        or(
          // New booking starts during existing booking
          and(
            sql`datetime(${bookings.checkInDate}) <= datetime(${checkInDate.toISOString()})`,
            sql`datetime(${bookings.checkOutDate}) > datetime(${checkInDate.toISOString()})`
          ),
          // New booking ends during existing booking
          and(
            sql`datetime(${bookings.checkInDate}) < datetime(${checkOutDate.toISOString()})`,
            sql`datetime(${bookings.checkOutDate}) >= datetime(${checkOutDate.toISOString()})`
          ),
          // New booking completely encompasses existing booking
          and(
            sql`datetime(${checkInDate.toISOString()}) <= datetime(${bookings.checkInDate})`,
            sql`datetime(${checkOutDate.toISOString()}) >= datetime(${bookings.checkOutDate})`
          ),
          // Existing booking completely encompasses new booking
          and(
            sql`datetime(${bookings.checkInDate}) <= datetime(${checkInDate.toISOString()})`,
            sql`datetime(${bookings.checkOutDate}) >= datetime(${checkOutDate.toISOString()})`
          )
        )
      ),
      limit: 1
    });
    
    return overlappingBookings.length === 0;
  }

  async getHotelUsers(hotelId: string) {
    const db = this.fastify.db;
    // added for testing
    // throw new ForbiddenError("You are not authorized to access this resource");

    // get all users with role hotel  and not part of hoteUsers table
    let allHotelUsers = await db
      .select({
        id: users.id,
        phone: users.phone,
      })
      .from(users)
      .leftJoin(hotelUsers, eq(users.id, hotelUsers.userId))
      .where(
        and(eq(users.role, UserRole.HOTEL_ADMIN), isNull(hotelUsers.userId))
      );

    console.log("here allHotelUsers", allHotelUsers);
    console.log("hotelId", hotelId);

    if (hotelId !== "") {
      console.log("hotelId included ", hotelId);
      const includedUser = await db.query.hotelUsers.findFirst({
        where: eq(hotelUsers.hotelId, hotelId),
        with: {
          user: true,
        },
      });

      console.log("includedUser", includedUser);

      if (includedUser) {
        allHotelUsers.push({
          id: includedUser.user.id,
          phone: includedUser.user.phone,
        });
      }
    }

    return allHotelUsers;
  }
}