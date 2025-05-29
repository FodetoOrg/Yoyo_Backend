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
} from "../models/schema";
import { eq, and, like, inArray, exists, not, isNull } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { UserRole } from "../types/common";
import { ForbiddenError } from "../types/errors";

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
  starRating?: number;
  amenities?: string[];
  hotelOwnerId: string;
  images?: string[];
}

interface RoomCreateParams {
  hotelId: string;
  name: string;
  description?: string;
  maxGuests: number;
  pricePerNight: number;
  pricePerHour?: number;
  roomType: string;
  amenities?: string[];
  available?: boolean;
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
      createdAt: hotel.createdAt,
      updatedAt: hotel.updatedAt,
      cityId: hotel.city.id,
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
      const hotelOwner = await tx.query.users.findFirst({
        where: eq(users.id, hotelData.hotelOwnerId),
      });

      if (!hotelOwner) {
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
        ownerId: hotelData.hotelOwnerId,
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
        userId: hotelData.hotelOwnerId,
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
  async updateHotel(hotelId: string, hotelData: Partial<HotelCreateParams>) {
    const db = this.fastify.db;

    // Process amenities if provided
    let processedData: any = { ...hotelData };
    if (hotelData.amenities) {
      processedData.amenities = JSON.stringify(hotelData.amenities);
    }

    await db
      .update(hotels)
      .set({
        ...processedData,
        updatedAt: new Date(),
      })
      .where(eq(hotels.id, hotelId));

    // Get the updated hotel
    const hotel = await this.getHotelById(hotelId);
    return hotel;
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

    await db.insert(rooms).values({
      id: roomId,
      hotelId: roomData.hotelId,
      name: roomData.name,
      description: roomData.description,
      maxGuests: roomData.maxGuests,
      pricePerNight: roomData.pricePerNight,
      pricePerHour: roomData.pricePerHour,
      roomType: roomData.roomType,
      amenities: roomData.amenities ? JSON.stringify(roomData.amenities) : null,
      available: roomData.available !== undefined ? roomData.available : true,
    });

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
      },
    });

    if (!room) {
      return null;
    }

    // Format room data
    return {
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

  // Update room details
  async updateRoom(roomId: string, roomData: Partial<RoomCreateParams>) {
    const db = this.fastify.db;

    // Process amenities if provided
    let processedData: any = { ...roomData };
    if (roomData.amenities) {
      processedData.amenities = JSON.stringify(roomData.amenities);
    }

    await db
      .update(rooms)
      .set({
        ...processedData,
        updatedAt: new Date(),
      })
      .where(eq(rooms.id, roomId));

    // Get the updated room
    const room = await this.getRoomById(roomId);
    return room;
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
