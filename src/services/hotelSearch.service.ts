import { FastifyInstance } from "fastify";
import { hotels, hotelImages, rooms, hotelReviews, wishlists, coupons, couponMappings, bookings } from "../models/schema";
import { eq, and, like, between, sql, desc, asc, inArray, exists, avg, count, not, or, lt, gt } from "drizzle-orm";

interface SearchFilters {
  // Location
  coordinates?: { lat: number; lng: number };
  city?: string;
  radius?: number; // in km
  
  // Dates and guests
  checkIn?: Date;
  checkOut?: Date;
  adults: number;
  children: number;
  infants: number;
  
  // Filters
  priceRange?: { min?: number; max?: number };
  starRating?: number; // minimum star rating
  amenities?: string[];
  sortBy?: 'recommended' | 'price_low' | 'price_high' | 'rating' | 'distance';
  
  // Pagination
  page?: number;
  limit?: number;
}

interface HomeTabFilters {
  userId?: string;
  coordinates?: { lat: number; lng: number };
  limit?: number;
}

export class HotelSearchService {
  private fastify!: FastifyInstance;

  setFastify(fastify: FastifyInstance) {
    this.fastify = fastify;
  }

  // Main hotel search with distance-based filtering
async searchHotels(filters: SearchFilters) {
  const db = this.fastify.db;
  const {
    coordinates,
    city, // Keep for context but don't filter by it
    radius = 50,
    checkIn,
    checkOut,
    adults,
    children,
    infants,
    priceRange,
    starRating,
    amenities,
    sortBy = 'distance', // Default to distance-based sorting
    page = 1,
    limit = 10
  } = filters;

  const totalGuests = adults + children; // infants don't count for capacity
  
  let whereConditions: any[] = [
    eq(hotels.status, 'active')
  ];

  // Remove city-based filtering - we'll use coordinates instead
  // if (city) {
  //   whereConditions.push(like(hotels.city, `%${city}%`));
  // }

  // Star rating filter
  if (starRating) {
    whereConditions.push(sql`CAST(${hotels.starRating} as INTEGER) >= ${starRating}`);
  }

  // Get base hotels with reviews and images
  const baseQuery = db
    .select({
      hotel: hotels,
      avgRating: avg(hotelReviews.overallRating),
      reviewCount: count(hotelReviews.id),
      primaryImage: hotelImages.url,
    })
    .from(hotels)
    .leftJoin(hotelReviews, and(
      eq(hotels.id, hotelReviews.hotelId),
      eq(hotelReviews.isApproved, true)
    ))
    .leftJoin(hotelImages, and(
      eq(hotels.id, hotelImages.hotelId),
      eq(hotelImages.isPrimary, true)
    ))
    .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
    .groupBy(hotels.id, hotelImages.url);

  let hotelsData = await baseQuery;

  console.log('hotel data ',hotelsData)

  // STEP 1: Distance calculation - Calculate distance for ALL hotels if coordinates provided
  if (coordinates) {
    hotelsData = hotelsData.map(hotel => ({
      ...hotel,
      distance: this.calculateDistance(
        coordinates.lat,
        coordinates.lng,
        this.parseCoordinates(hotel.hotel.mapCoordinates)
      )
    }));
    
    // Sort by distance first to get nearest hotels
    hotelsData = hotelsData.sort((a, b) => (a.distance || 0) - (b.distance || 0));
    console.log('calculated distance ',hotelsData)
    
    // Filter by radius after calculating distance
    hotelsData = hotelsData.filter(hotel => hotel.distance <= radius);
  }

  // STEP 2: Filter by available rooms for dates and guest capacity
  if (checkIn && checkOut) {
    const availableHotelIds = await this.getHotelsWithAvailableRooms(
      checkIn,
      checkOut,
      totalGuests,
      priceRange
    );
    
    if (availableHotelIds.length === 0) {
      return {
        hotels: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
      };
    }
    
    // Filter hotels to only include those with available rooms
    hotelsData = hotelsData.filter(h => availableHotelIds.includes(h.hotel.id));
    console.log('after all filtering ',hotelsData)
  }

  // STEP 3: Amenities filtering
  if (amenities && amenities.length > 0) {
    hotelsData = hotelsData.filter(hotel => {
      const hotelAmenities = hotel.hotel.amenities ? JSON.parse(hotel.hotel.amenities) : [];
      return amenities.every(amenity => hotelAmenities.includes(amenity));
    });
  }

  // STEP 4: Final sorting (distance is already applied if coordinates provided)
  if (!coordinates || sortBy !== 'distance') {
    hotelsData = this.sortHotels(hotelsData, sortBy);
  }

  // Get pricing for each hotel and filter out hotels with no available rooms
  const hotelsWithPricing = [];
  
  for (const hotelData of hotelsData) {
    const pricing = await this.getHotelPricing(hotelData.hotel.id, checkIn, checkOut, totalGuests);
    
    // Skip hotels with no available rooms (pricing will be null)
    if (!pricing) {
      continue;
    }
    
    const offers = await this.getHotelOffers(hotelData.hotel.id);
    
    hotelsWithPricing.push({
      id: hotelData.hotel.id,
      name: hotelData.hotel.name,
      description: hotelData.hotel.description,
      address: hotelData.hotel.address,
      city: hotelData.hotel.city,
      starRating: parseInt(hotelData.hotel.starRating || '0'),
      amenities: hotelData.hotel.amenities ? JSON.parse(hotelData.hotel.amenities) : [],
      coordinates: this.parseCoordinates(hotelData.hotel.mapCoordinates),
      distance: hotelData.distance || null,
      rating: {
        average: Math.round((hotelData.avgRating || 0) * 10) / 10,
        count: hotelData.reviewCount || 0,
      },
      pricing: pricing,
      offers: offers,
      images: {
        primary: hotelData.primaryImage,
        gallery: await this.getHotelImages(hotelData.hotel.id),
      },
      paymentOptions: {
        onlineEnabled: hotelData.hotel.onlinePaymentEnabled,
        offlineEnabled: hotelData.hotel.offlinePaymentEnabled,
      }
    });
  }

  // Pagination
  const total = hotelsWithPricing.length;
  const totalPages = Math.ceil(total / limit);
  const startIndex = (page - 1) * limit;
  const paginatedHotels = hotelsWithPricing.slice(startIndex, startIndex + limit);

  return {
    hotels: paginatedHotels,
    total,
    page,
    limit,
    totalPages,
    filters: {
      appliedFilters: {
        location: coordinates ? `${coordinates.lat}, ${coordinates.lng}` : (city || 'All locations'),
        radius: coordinates ? radius : null,
        dates: checkIn && checkOut ? { checkIn, checkOut } : null,
        guests: { adults, children, infants },
        priceRange,
        starRating,
        amenities,
      }
    }
  };
}
  // Home page tabs
  async getNearbyHotels(filters: HomeTabFilters) {
    const { coordinates, limit = 10 } = filters;
    
    if (!coordinates) {
      return [];
    }

    const searchFilters: SearchFilters = {
      coordinates,
      radius: 25, // 25km radius for nearby
      adults: 2,
      children: 0,
      infants: 0,
      sortBy: 'distance',
      limit,
    };

    const result = await this.searchHotels(searchFilters);
    return result.hotels;
  }

  async getLatestHotels(filters: HomeTabFilters) {
    const db = this.fastify.db;
    const { limit = 10 } = filters;

    const latestHotels = await db.query.hotels.findMany({
      where: eq(hotels.status, 'active'),
      with: {
        images: {
        
          limit: 1,
        }
      },
      orderBy: [desc(hotels.createdAt)],
      limit,
    });

    return Promise.all(
      latestHotels.map(async (hotel) => {
        const reviews = await db.query.hotelReviews.findMany({
          where: and(
            eq(hotelReviews.hotelId, hotel.id),
            eq(hotelReviews.isApproved, true)
          ),
        });

        const avgRating = reviews.length > 0 
          ? reviews.reduce((sum, r) => sum + r.overallRating, 0) / reviews.length 
          : 0;

        const pricing = await this.getHotelPricing(hotel.id);

        console.log('hotel is ',hotel)

        return {
          id: hotel.id,
          name: hotel.name,
          description: hotel.description,
          address: hotel.address,
          city: hotel.city,
          starRating: parseInt(hotel.starRating || '0'),
          amenities: hotel.amenities ? JSON.parse(hotel.amenities) : [],
          coordinates: this.parseCoordinates(hotel.mapCoordinates),
          rating: {
            average: Math.round(avgRating * 10) / 10,
            count: reviews.length,
          },
          pricing: pricing ? {
            startingFrom: pricing.startingFrom,
            range: pricing.range,
            currency: pricing.currency,
            totalPrice: pricing.totalPrice,
            perNight: pricing.perNight
          } : null,
          images: {
            primary: hotel.images[0]?.url || null,
            gallery: []
          },
          isNew: true,
          paymentOptions:{
            onlineEnabled:hotel.onlinePaymentEnabled,
            offlineEnabled:hotel.offlinePaymentEnabled
          }
        };
      })
    );
  }

  async getOffersHotels(filters: HomeTabFilters) {
    const db = this.fastify.db;
    const { limit = 10 } = filters;

    // Get hotels with active coupons
    const hotelsWithOffers = await db
      .select({
        hotel: hotels,
        coupon: coupons,
        primaryImage: hotelImages.url,
      })
      .from(hotels)
      .innerJoin(couponMappings, eq(hotels.id, couponMappings.hotelId))
      .innerJoin(coupons, and(
        eq(couponMappings.couponId, coupons.id),
        eq(coupons.status, 'active'),
        sql`${coupons.validFrom} <= datetime('now')`,
        sql`${coupons.validTo} >= datetime('now')`
      ))
      .leftJoin(hotelImages, and(
        eq(hotels.id, hotelImages.hotelId),
        eq(hotelImages.isPrimary, true)
      ))
      .where(eq(hotels.status, 'active'))
      .limit(limit);

    return Promise.all(
      hotelsWithOffers.map(async (item) => {
        const reviews = await db.query.hotelReviews.findMany({
          where: and(
            eq(hotelReviews.hotelId, item.hotel.id),
            eq(hotelReviews.isApproved, true)
          ),
        });

        const avgRating = reviews.length > 0 
          ? reviews.reduce((sum, r) => sum + r.overallRating, 0) / reviews.length 
          : 0;

        const pricing = await this.getHotelPricing(item.hotel.id);

        return {
          id: item.hotel.id,
          name: item.hotel.name,
          description: item.hotel.description,
          address: item.hotel.address,
          city: item.hotel.city,
          starRating: parseInt(item.hotel.starRating || '0'),
          amenities: item.hotel.amenities ? JSON.parse(item.hotel.amenities) : [],
          coordinates: this.parseCoordinates(item.hotel.mapCoordinates),
          rating: {
            average: Math.round(avgRating * 10) / 10,
            count: reviews.length,
          },
          pricing,
          images: {
            primary: item.primaryImage,
          },
          offer: {
            title: item.coupon.description || `${item.coupon.discountValue}% OFF`,
            discountType: item.coupon.discountType,
            discountValue: item.coupon.discountValue,
            code: item.coupon.code,
            validUntil: item.coupon.validTo,
          },
        };
      })
    );
  }

  // Helper methods
  private async getHotelsWithAvailableRooms(
    checkIn: Date,
    checkOut: Date,
    guestCount: number,
    priceRange?: { min?: number; max?: number }
  ): Promise<string[]> {
    const db = this.fastify.db;

    
    let roomConditions: any[] = [
      sql`${rooms.capacity} >= ${guestCount}`,
      // Remove the status check as we'll check availability based on bookings
    ];

    if (priceRange?.min) {
      roomConditions.push(sql`${rooms.pricePerNight} >= ${priceRange.min}`);
    }
    if (priceRange?.max) {
      roomConditions.push(sql`${rooms.pricePerNight} <= ${priceRange.max}`);
    }

    // Get all rooms that match criteria
    const allRooms = await db
      .select({ 
        roomId: rooms.id,
        hotelId: rooms.hotelId 
      })
      .from(rooms)
      .where(and(...roomConditions));

    // Check each room for booking conflicts
    const availableHotelIds = new Set<string>();

    for (const room of allRooms) {
      const hasConflict = await this.checkRoomBookingConflict(
        room.roomId,
        checkIn,
        checkOut
      );

      if (!hasConflict) {
        availableHotelIds.add(room.hotelId);
      }
    }

    return Array.from(availableHotelIds);
  }

  private async checkRoomBookingConflict(
    roomId: string,
    checkIn: Date,
    checkOut: Date
  ): Promise<boolean> {
    const db = this.fastify.db;

    // Check for overlapping bookings that are not cancelled
    // Two bookings overlap if: checkIn < existing.checkOut AND checkOut > existing.checkIn
    console.log('checkin ',checkIn)
    console.log('checkout ',checkOut)

   const conflictingBookings = await db.query.bookings.findMany({
      where: and(
        eq(bookings.roomId, roomId),
        not(eq(bookings.status, 'cancelled')),
        lt(bookings.checkInDate, checkOut), // existing booking starts before new booking ends
        gt(bookings.checkOutDate, checkIn)  // existing booking ends after new booking starts
      ),
      limit: 1
    });

    console.log('conflictingBookings ',conflictingBookings)

    return conflictingBookings.length > 0;
  }

  private async getHotelPricing(hotelId: string, checkIn?: Date, checkOut?: Date, guestCount?: number) {
    const db = this.fastify.db;

    let roomConditions: any[] = [
      eq(rooms.hotelId, hotelId),
      eq(rooms.status, 'available') // Only include available rooms
    ];
    
    // Always filter by guest capacity if provided
    if (guestCount) {
      roomConditions.push(sql`${rooms.capacity} >= ${guestCount}`);
    }

    let availableRooms = await db.query.rooms.findMany({
      where: and(...roomConditions),
      orderBy: [asc(rooms.pricePerNight)],
    });

    // If dates are provided, further filter by booking availability
    if (checkIn && checkOut && availableRooms.length > 0) {
      const actuallyAvailableRooms = [];
      
      for (const room of availableRooms) {
        const hasConflict = await this.checkRoomBookingConflict(
          room.id,
          checkIn,
          checkOut
        );
        
        if (!hasConflict) {
          actuallyAvailableRooms.push(room);
        }
      }
      
      availableRooms = actuallyAvailableRooms;
    }

    // Return null if no rooms are available (this will exclude hotel from search results)
    if (availableRooms.length === 0) {
      return null;
    }

    const minPrice = Math.min(...availableRooms.map(r => r.pricePerNight));
    const maxPrice = Math.max(...availableRooms.map(r => r.pricePerNight));

    let totalPrice = null;
    if (checkIn && checkOut) {
      const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
      totalPrice = minPrice * nights;
    }

    return {
      startingFrom: minPrice,
      range: { min: minPrice, max: maxPrice },
      currency: 'INR',
      totalPrice,
      perNight: true,
      availableRooms: availableRooms.length
    };
  }

  private async getHotelOffers(hotelId: string) {
    const db = this.fastify.db;

    const offers = await db
      .select({ coupon: coupons })
      .from(couponMappings)
      .innerJoin(coupons, and(
        eq(couponMappings.couponId, coupons.id),
        eq(coupons.status, 'active'),
        sql`${coupons.validFrom} <= datetime('now')`,
        sql`${coupons.validTo} >= datetime('now')`
      ))
      .where(eq(couponMappings.hotelId, hotelId))
      .limit(3);

    return offers.map(offer => ({
      title: offer.coupon.description || `${offer.coupon.discountValue}% OFF`,
      discountType: offer.coupon.discountType,
      discountValue: offer.coupon.discountValue,
      code: offer.coupon.code,
    }));
  }

  private async getHotelImages(hotelId: string) {
    const db = this.fastify.db;
    
    const images = await db.query.hotelImages.findMany({
      where: eq(hotelImages.hotelId, hotelId),
      orderBy: [desc(hotelImages.isPrimary)],
    });

    return images.map(img => img.url);
  }

  private sortHotels(hotels: any[], sortBy: string) {
    switch (sortBy) {
      case 'price_low':
        return hotels.sort((a, b) => (a.pricing?.startingFrom || 0) - (b.pricing?.startingFrom || 0));
      case 'price_high':
        return hotels.sort((a, b) => (b.pricing?.startingFrom || 0) - (a.pricing?.startingFrom || 0));
      case 'rating':
        return hotels.sort((a, b) => (b.avgRating || 0) - (a.avgRating || 0));
      case 'distance':
        return hotels.sort((a, b) => (a.distance || 0) - (b.distance || 0));
      case 'recommended':
      default:
        // Recommended: combination of rating, reviews, and distance
        return hotels.sort((a, b) => {
          const scoreA = (a.avgRating || 0) * 0.4 + (a.reviewCount || 0) * 0.3 + (1 / (a.distance || 1)) * 0.3;
          const scoreB = (b.avgRating || 0) * 0.4 + (b.reviewCount || 0) * 0.3 + (1 / (b.distance || 1)) * 0.3;
          return scoreB - scoreA;
        });
    }
  }

  private calculateDistance(lat1: number, lng1: number, coords2: { lat: number; lng: number }): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.deg2rad(coords2.lat - lat1);
    const dLng = this.deg2rad(coords2.lng - lng1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(coords2.lat)) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI/180);
  }

  private parseCoordinates(coordString: string): { lat: number; lng: number } {
    const [lat, lng] = coordString.split(',').map(Number);
    return { lat: lat || 17.4065, lng: lng || 78.4772 };
  }
}