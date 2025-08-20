// @ts-nocheck
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
  roomAddons,
  configurations // Assuming configurations table is imported
} from "../models/schema";

import { v4 as uuidv4 } from "uuid";
import { eq, and, like, inArray, exists, not, isNull, desc, or, sql, lt, gt } from "drizzle-orm";
import { UserRole } from "../types/common";
import { ForbiddenError } from "../types/errors";
import { uploadToStorage } from "../config/firebase/firebase.ts";
import { formatTimeAgo } from "../utils/helpers";


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
  cancellationPeriodHours?: number;
  gstPercentage: number;
  about?: string
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

  async getHotels(type) {
    const db = this.fastify.db;
    let whereConditions: any[] = [];
    if (type && (type === 'active' || type === 'inactive')) {
      whereConditions.push(eq(hotels.status, type));
    }

    const hotelsReturn = await db.query.hotels.findMany(
      {
        where: and(...whereConditions),
      }
    );
    return hotelsReturn;
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
    const platformFeeConfig = await db.query.configurations.findFirst({
      where: eq(configurations.key, 'platform_fee')
    });



    // Format hotel data
    return {
      id: hotel.id,
      name: hotel.name,
      description: hotel.description,
      address: hotel.address,
      about: hotel.about,
      platformFee: platformFeeConfig ? parseFloat(platformFeeConfig.value) : 5,
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
      cancellationPeriodHours: hotel.cancellationPeriodHours,
      createdAt: hotel.createdAt,
      updatedAt: hotel.updatedAt,
      cityId: hotel.city ? hotel.city.cityId : null,
      mapCoordinates: hotel.mapCoordinates,
      gstPercentage: hotel.gstPercentage,
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
        about: hotelData.about,
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
        onlinePaymentEnabled: hotelData.onlinePaymentEnabled ?? true,
        offlinePaymentEnabled: hotelData.offlinePaymentEnabled !== false, // Default true
        cancellationPeriodHours: hotelData.cancellationPeriodHours ?? 24,
        // Initialize GST percentage
        gstPercentage: hotelData.gstPercentage,
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
    console.log('processedData ', processedData.id)
    return await db.transaction(async (tx) => {
      const existingData: Hotel = await tx.query.hotels.findFirst({
        where: eq(hotels.id, processedData.id),
      });

      if (!existingData) {
        throw new ForbiddenError("Hotel not found");
      }

      const hotelOwner = await tx.query.hotelUsers.findFirst({
        where: eq(hotelUsers.userId, processedData.ownerId),
      });

      if (hotelOwner && hotelOwner.userId !== existingData.ownerId) {
        throw new ForbiddenError("Hotel owner already assigned to other hotel");
      }

      // check if hotel city exists
      const hotelCity = await tx.query.cities.findFirst({
        where: eq(cities.id, processedData.cityId),
      });

      if (!hotelCity) {
        throw new ForbiddenError("Hotel city not found");
      }

      if (existingData.ownerId !== hotelData.ownerId) {
        await tx
          .delete(hotelUsers)
          .where(eq(hotelUsers.hotelId, existingData.id));

        await tx.insert(hotelUsers).values({
          hotelId: hotelData.id,
          userId: hotelData.ownerId,
          id: uuidv4(),
        });
      }

      const existingCity = await tx.query.hotelCities.findFirst({
        where: eq(hotelCities.hotelId, processedData.id),
      });

      if (existingCity.cityId !== processedData.cityId) {
        await tx
          .delete(hotelCities)
          .where(eq(hotelCities.cityId, existingCity.cityId));

        await tx.insert(hotelCities).values({
          hotelId: processedData.id,
          cityId: processedData.cityId,
          id: uuidv4(),
        });
      }
      // 1. Get existing image records from DB
      const existingHotelImages = await db.query.hotelImages.findMany({
        where: eq(hotelImages.hotelId, processedData.id)
      });

      // 2. Extract existing image IDs
      const keptImageIds = processedData.images
        .filter(image => typeof image !== 'object' || image === null || !('id' in image))
        .map(img => img.id); // This line needs to be corrected based on actual image structure

      // 3. Determine which image IDs to delete
      const imageIdsToDelete = existingHotelImages
        .filter(img => !keptImageIds.includes(img.id))
        .map(img => img.id);

      // 4. Delete those images from DB
      if (imageIdsToDelete.length > 0) {
        await tx.delete(hotelImages).where(inArray(hotelImages.id, imageIdsToDelete));
      }

      // 5. Handle updated images (base64 or URL)
      const imageUrls = await Promise.all(
        processedData.images
          .filter(image => typeof image === 'string' || (typeof image === 'object' && image !== null && 'url' in image)) // Handle both string URLs and objects with URLs
          .map(async (image) => {
            if (typeof image === 'string' && image.startsWith('data:image/')) {
              const buffer = Buffer.from(image.split(',')[1], 'base64');
              return await uploadToStorage(buffer, `hotel-${processedData.id}-${Date.now()}.jpg`, 'image/jpeg');
            } else if (typeof image === 'object' && image !== null && 'url' in image) {
              return image.url; // If it's an existing image URL
            }
            return image; // Should not happen if filter is correct
          })
      );

      // 6. Insert new image records into DB
      if (imageUrls.length > 0) {
        await tx.insert(hotelImages).values(
          imageUrls.map(url => ({
            id: uuidv4(),
            hotelId: processedData.id,
            url: url,
            isPrimary: false, // Default to false, primary can be handled separately if needed
          }))
        );
      }


      await tx
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
            return await uploadToStorage(buffer, `room-${roomId}-${Date.now()}.jpg`, 'image/jpeg');
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

    const reviews = await db.select({
      id: hotelReviews.id,
      userId: hotelReviews.userId,
      rating: hotelReviews.rating,
      comment: hotelReviews.comment,
      bookingId: hotelReviews.bookingId,
      isVerified: hotelReviews.isVerified,
      isApproved: hotelReviews.isApproved,
      createdAt: hotelReviews.createdAt,
      updatedAt: hotelReviews.updatedAt,
      // Guest information from booking
      guestName: bookings.guestName,
      guestEmail: bookings.guestEmail,
      guestPhone: bookings.guestPhone,
    })
      .from(hotelReviews)
      .leftJoin(bookings, eq(hotelReviews.bookingId, bookings.id))
      .where(and(
        eq(hotelReviews.hotelId, hotelId),
        eq(hotelReviews.isApproved, true)
      ))
      .orderBy(desc(hotelReviews.createdAt));

    // Calculate rating statistics
    const totalReviews = reviews.length;
    const overallRating = totalReviews > 0 ?
      reviews.reduce((sum, review) => sum + (review.rating || 0), 0) / totalReviews : null;

    // Rating breakdown (count of each star rating)
    const ratingBreakdown = {
      5: reviews.filter(r => r.rating === 5).length,
      4: reviews.filter(r => r.rating === 4).length,
      3: reviews.filter(r => r.rating === 3).length,
      2: reviews.filter(r => r.rating === 2).length,
      1: reviews.filter(r => r.rating === 1).length,
    };

    // Transform reviews to match frontend expected format
    const transformedReviews = reviews.map(review => ({
      id: review.id,
      userId: review.userId,
      userName: review.guestName || 'Anonymous Guest',
      userImage: null, // No profile images for booking guests
      rating: review.rating,
      comment: review.comment || '',
      date: review.createdAt.toISOString().split('T')[0], // Format as YYYY-MM-DD
      timeAgo: formatTimeAgo(review.createdAt),
      isVerified: review.isVerified,
      bookingId: review.bookingId,
      guestEmail: review.guestEmail,
      guestPhone: review.guestPhone,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
    }));

    return {
      overallRating: overallRating ? Math.round(overallRating * 10) / 10 : null,
      totalReviews,
      ratingBreakdown,
      reviews: transformedReviews
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
              return await uploadToStorage(buffer, `room-${roomId}-${Date.now()}.jpg`, 'image/jpeg');
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
        hourlyStays: true
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
      hourlyStays: room.hourlyStays,
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


  async normalizeDate(dateStr) {
    // If date already has a timezone indicator, use it directly
    if (dateStr.endsWith('Z') || dateStr.includes('+')) {
      return new Date(dateStr);
    }
    return new Date(dateStr + 'Z');
  };

  // Check room availability
  async checkRoomAvailability(roomId: string, checkInDate: Date, checkOutDate: Date): Promise<boolean> {
    const db = this.fastify.db;

    console.log('----- checkInDate ', checkInDate)
    console.log('------- checkou ', checkOutDate)

    // Get room from database
    const room = await db.query.rooms.findFirst({
      where: eq(rooms.id, roomId)
    });

    console.log('room is ', room)

    if (!room) {
      return false;
    }



    const bookingsr = await db.query.bookings.findMany({
      where:
        and(eq(bookings.roomId, roomId),
          not(eq(bookings.status, 'cancelled')))
    })
    console.log('bookings ', bookingsr)
    const overlappingBookings = await db.query.bookings.findMany({
      where: and(
        eq(bookings.roomId, roomId),
        not(eq(bookings.status, 'cancelled')),
        lt(bookings.checkInDate, checkOutDate), // existing booking starts before new booking ends
        gt(bookings.checkOutDate, checkInDate)  // existing booking ends after new booking starts
      ),
      limit: 1
    });

    return overlappingBookings.length === 0;
  }

  // Get room addons
  async getRoomAddons(roomId: string) {
    const db = this.fastify.db;

    const roomAddonsRetunerd = await db.query.roomAddons.findMany({
      where: eq(roomAddons.roomId, roomId),
      with: {
        addon: true,
      },
    });

    console.log('roomAddonsRetunerd ', roomAddonsRetunerd)
    console.log('for roomid ', roomId)

    return roomAddonsRetunerd.map(roomAddon => ({
      id: roomAddon.addon.id,
      name: roomAddon.addon.name,
      description: roomAddon.addon.description,
      image: roomAddon.addon.image,
      price: roomAddon.addon.price,
      status: roomAddon.addon.status,
    }));
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

  // Add this method to HotelService
  async getHotelWithGstDetails(hotelId: string) {
    const db = this.fastify.db;

    const hotel = await db.query.hotels.findFirst({
      where: eq(hotels.id, hotelId),
      with: {
        rooms: true, // Assuming you might need rooms, adjust as necessary
        images: true, // Assuming you might need images, adjust as necessary
      }
    });

    if (!hotel) {
      throw new Error('Hotel not found');
    }

    // Get platform fee configuration
    const platformFeeConfig = await db.query.configurations.findFirst({
      where: eq(configurations.key, 'platform_fee')
    });

    return {
      ...hotel,
      gstPercentage: hotel.gstPercentage, // Assuming gstPercentage is a field in your Hotel schema
      platformFeePercentage: platformFeeConfig ? parseFloat(platformFeeConfig.value) : 5 // Default to 5% if not found
    };
  }
}