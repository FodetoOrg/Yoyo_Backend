import { FastifyInstance } from "fastify";
import { wishlists, hotels, hotelImages, hotelReviews, rooms } from "../models/schema";
import { eq, and, desc, avg, count, asc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { NotFoundError, ConflictError } from "../types/errors";

export class WishlistService {
  private fastify!: FastifyInstance;

  setFastify(fastify: FastifyInstance) {
    this.fastify = fastify;
  }

  // Get user's wishlist
  async getUserWishlist(userId: string, page: number = 1, limit: number = 10) {
    const db = this.fastify.db;

    const wishlistItems = await db.query.wishlists.findMany({
      where: eq(wishlists.userId, userId),
      with: {
        hotel: {
          with: {
            images: {
              where: eq(hotelImages.isPrimary, true),
              limit: 1,
            }
          }
        }
      },
      orderBy: [desc(wishlists.createdAt)],
      limit,
      offset: (page - 1) * limit,
    });

    // Get total count
    const totalItems = await db.query.wishlists.findMany({
      where: eq(wishlists.userId, userId),
    });

    // Enhance with ratings and pricing
    const enhancedItems = await Promise.all(
      wishlistItems.map(async (item) => {
        // Get hotel reviews
        const reviews = await db.query.hotelReviews.findMany({
          where: and(
            eq(hotelReviews.hotelId, item.hotelId),
            eq(hotelReviews.isApproved, true)
          ),
        });

        const avgRating = reviews.length > 0 
          ? reviews.reduce((sum, r) => sum + r.overallRating, 0) / reviews.length 
          : 0;

        // Get pricing (cheapest room)
        const pricing = await this.getHotelPricing(item.hotelId);

        return {
          id: item.id,
          addedAt: item.createdAt,
          hotel: {
            id: item.hotel.id,
            name: item.hotel.name,
            description: item.hotel.description,
            address: item.hotel.address,
            city: item.hotel.city,
            starRating: parseInt(item.hotel.starRating || '0'),
            amenities: item.hotel.amenities ? JSON.parse(item.hotel.amenities) : [],
            coordinates: this.parseCoordinates(item.hotel.mapCoordinates),
            distance:0,
            rating: {
              average: Math.round(avgRating * 10) / 10,
              count: reviews.length,
            },
            pricing,
            images: {
              primary: item.hotel.images[0]?.url || null,
            },
            paymentOptions: {
              onlineEnabled: item.hotel.onlinePaymentEnabled,
              offlineEnabled: item.hotel.offlinePaymentEnabled,
            }
          }
        };
      })
    );

    return {
      items: enhancedItems,
      total: totalItems.length,
      page,
      limit,
      totalPages: Math.ceil(totalItems.length / limit),
    };
  }

  // Add hotel to wishlist
  async addToWishlist(userId: string, hotelId: string) {
    const db = this.fastify.db;

    // Check if hotel exists
    const hotel = await db.query.hotels.findFirst({
      where: eq(hotels.id, hotelId)
    });

    if (!hotel) {
      throw new NotFoundError('Hotel not found');
    }

    // Check if already in wishlist
    const existingItem = await db.query.wishlists.findFirst({
      where: and(
        eq(wishlists.userId, userId),
        eq(wishlists.hotelId, hotelId)
      )
    });

    if (existingItem) {
      throw new ConflictError('Hotel already in wishlist');
    }

    // Add to wishlist
    const wishlistId = uuidv4();
    await db.insert(wishlists).values({
      id: wishlistId,
      userId,
      hotelId,
    });

    return {
      id: wishlistId,
      message: 'Hotel added to wishlist successfully',
      hotel: {
        id: hotel.id,
        name: hotel.name,
      }
    };
  }

  // Remove hotel from wishlist
  async removeFromWishlist(userId: string, hotelId: string) {
    const db = this.fastify.db;

    const result = await db
      .delete(wishlists)
      .where(and(
        eq(wishlists.userId, userId),
        eq(wishlists.hotelId, hotelId)
      ))
      .returning();

    if (result.length === 0) {
      throw new NotFoundError('Hotel not found in wishlist');
    }

    return {
      message: 'Hotel removed from wishlist successfully'
    };
  }

  // Remove wishlist item by ID (with ownership validation)
  async removeWishlistItem(userId: string, itemId: string) {
    const db = this.fastify.db;

    // First check if the wishlist item exists and belongs to the user
    const wishlistItem = await db.query.wishlists.findFirst({
      where: eq(wishlists.id, itemId)
    });

    if (!wishlistItem) {
      throw new NotFoundError('Wishlist item not found');
    }

    if (wishlistItem.userId !== userId) {
      throw new NotFoundError('Wishlist item not found');
    }

    // Remove the wishlist item
    await db
      .delete(wishlists)
      .where(eq(wishlists.id, itemId));

    return {
      message: 'Wishlist item removed successfully'
    };
  }

  // Check if hotel is in user's wishlist
  async isInWishlist(userId: string, hotelId: string) {
    const db = this.fastify.db;

    const item = await db.query.wishlists.findFirst({
      where: and(
        eq(wishlists.userId, userId),
        eq(wishlists.hotelId, hotelId)
      )
    });

    return {
      isInWishlist: !!item,
      addedAt: item?.createdAt || null,
    };
  }

  // Get wishlist count
  async getWishlistCount(userId: string) {
    const db = this.fastify.db;

    const items = await db.query.wishlists.findMany({
      where: eq(wishlists.userId, userId),
    });

    return {
      count: items.length
    };
  }

  // Clear entire wishlist
  async clearWishlist(userId: string) {
    const db = this.fastify.db;

    const result = await db
      .delete(wishlists)
      .where(eq(wishlists.userId, userId))
      .returning();

    return {
      message: 'Wishlist cleared successfully',
      removedCount: result.length,
    };
  }

  // Helper methods
  private async getHotelPricing(hotelId: string) {
    const db = this.fastify.db;

    const hotelRooms = await db.query.rooms.findMany({
      where: eq(rooms.hotelId, hotelId),
      orderBy: [asc(rooms.pricePerNight)],
    });

    if (hotelRooms.length === 0) {
      return null;
    }

    const minPrice = Math.min(...hotelRooms.map(r => r.pricePerNight));
    const maxPrice = Math.max(...hotelRooms.map(r => r.pricePerNight));

    return {
      startingFrom: minPrice,
      range: { min: minPrice, max: maxPrice },
      currency: 'INR',
      perNight: true,
    };
  }

  private parseCoordinates(coordString: string): { lat: number; lng: number } {
    const [lat, lng] = coordString.split(',').map(Number);
    return { lat: lat || 17.4065, lng: lng || 78.4772 };
  }
}