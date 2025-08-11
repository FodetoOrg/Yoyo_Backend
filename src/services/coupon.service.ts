import { FastifyInstance } from "fastify";
import { coupons, couponMappings, cities, hotels, roomTypes, couponUsages, bookings } from "../models/schema";
import { eq, and, desc, inArray, isNull, lt, or } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { NotFoundError, ConflictError } from "../types/errors";

interface CouponCreateParams {
  code: string;
  description?: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  maxDiscountAmount?: number;
  minOrderAmount?: number;
  validFrom: Date;
  validTo: Date;
  usageLimit?: number;
  priceIncreasePercentage?: number;
  mappings: {
    cityIds?: string[];
    hotelIds?: string[];
    roomTypeIds?: string[];
  };
}

interface CouponFilters {
  status?: string;
  page?: number;
  limit?: number;
}

export class CouponService {
  private fastify!: FastifyInstance;

  setFastify(fastify: FastifyInstance) {
    this.fastify = fastify;
  }

  // Get all coupons
  async getCoupons(filters: CouponFilters = {}) {
    const db = this.fastify.db;
    const { status, page = 1, limit = 10 } = filters;

    let whereCondition = status ? eq(coupons.status, status) : undefined;

    const couponList = await db.query.coupons.findMany({
      where: whereCondition,
      with: {
        mappings: {
          with: {
            city: true,
            hotel: true,
            roomType: true,
          },
        },
      },
      orderBy: [desc(coupons.createdAt)],
      limit,
      offset: (page - 1) * limit,
    });

    // Get total count
    const totalCoupons = await db.query.coupons.findMany({
      where: whereCondition,
    });

    return {
      coupons: couponList.map(coupon => ({
        id: coupon.id,
        code: coupon.code,
        description: coupon.description,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        maxDiscountAmount: coupon.maxDiscountAmount,
        minOrderAmount: coupon.minOrderAmount,
        validFrom: coupon.validFrom,
        validTo: coupon.validTo,
        usageLimit: coupon.usageLimit,
        usedCount: coupon.usedCount,
        priceIncreasePercentage: coupon.priceIncreasePercentage,
        status: coupon.status,
        createdAt: coupon.createdAt,
        updatedAt: coupon.updatedAt,
        mappings: {
          cities: coupon.mappings.filter(m => m.cityId).map(m => ({
            id: m.city?.id,
            name: m.city?.name,
            state: m.city?.state,
          })),
          hotels: coupon.mappings.filter(m => m.hotelId).map(m => ({
            id: m.hotel?.id,
            name: m.hotel?.name,
            city: m.hotel?.city,
          })),
          roomTypes: coupon.mappings.filter(m => m.roomTypeId).map(m => ({
            id: m.roomType?.id,
            name: m.roomType?.name,
          })),
        },
      })),
      total: totalCoupons.length,
      page,
      limit,
      totalPages: Math.ceil(totalCoupons.length / limit),
    };
  }

  // Get coupon by ID
  async getCouponById(id: string) {
    const db = this.fastify.db;

    const coupon = await db.query.coupons.findFirst({
      where: eq(coupons.id, id),
      with: {
        mappings: {
          with: {
            city: true,
            hotel: true,
            roomType: true,
          },
        },
      },
    });

    if (!coupon) {
      throw new NotFoundError(`Coupon with id ${id} not found`);
    }

    return {
      id: coupon.id,
      code: coupon.code,
      description: coupon.description,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      maxDiscountAmount: coupon.maxDiscountAmount,
      minOrderAmount: coupon.minOrderAmount,
      validFrom: coupon.validFrom,
      validTo: coupon.validTo,
      usageLimit: coupon.usageLimit,
      usedCount: coupon.usedCount,
      priceIncreasePercentage: coupon.priceIncreasePercentage,
      status: coupon.status,
      createdAt: coupon.createdAt,
      updatedAt: coupon.updatedAt,
      mappings: {
        cities: coupon.mappings.filter(m => m.cityId).map(m => ({
          id: m.city?.id,
          name: m.city?.name,
          state: m.city?.state,
        })),
        hotels: coupon.mappings.filter(m => m.hotelId).map(m => ({
          id: m.hotel?.id,
          name: m.hotel?.name,
          city: m.hotel?.city,
        })),
        roomTypes: coupon.mappings.filter(m => m.roomTypeId).map(m => ({
          id: m.roomType?.id,
          name: m.roomType?.name,
        })),
      },
    };
  }

  // Create coupon
  async createCoupon(data: CouponCreateParams) {
    const db = this.fastify.db;

    // Check if coupon code already exists
    const existingCoupon = await db.query.coupons.findFirst({
      where: eq(coupons.code, data.code),
    });

    if (existingCoupon) {
      throw new ConflictError(`Coupon with code "${data.code}" already exists`);
    }

    return await db.transaction(async (tx) => {
      const couponId = uuidv4();

      // Create coupon
      await tx.insert(coupons).values({
        id: couponId,
        code: data.code,
        description: data.description,
        discountType: data.discountType,
        discountValue: data.discountValue,
        maxDiscountAmount: data.maxDiscountAmount,
        minOrderAmount: data.minOrderAmount || 0,
        validFrom: data.validFrom,
        validTo: data.validTo,
        usageLimit: data.usageLimit,
        priceIncreasePercentage: data.priceIncreasePercentage || 0,
      });

      // Create mappings
      const mappingInserts: any[] = [];

      // City mappings
      if (data.mappings.cityIds?.length) {
        for (const cityId of data.mappings.cityIds) {
          mappingInserts.push({
            id: uuidv4(),
            couponId,
            cityId,
          });
        }
      }

      // Hotel mappings
      if (data.mappings.hotelIds?.length) {
        for (const hotelId of data.mappings.hotelIds) {
          mappingInserts.push({
            id: uuidv4(),
            couponId,
            hotelId,
          });
        }
      }

      // Room type mappings
      if (data.mappings.roomTypeIds?.length) {
        for (const roomTypeId of data.mappings.roomTypeIds) {
          mappingInserts.push({
            id: uuidv4(),
            couponId,
            roomTypeId,
          });
        }
      }

      if (mappingInserts.length > 0) {
        await tx.insert(couponMappings).values(mappingInserts);
      }

      return couponId;
    });
  }

  // Update coupon
  async updateCoupon(id: string, data: Partial<CouponCreateParams>) {
    const db = this.fastify.db;

    // Check if coupon exists
    await this.getCouponById(id);

    // Check if code is being changed and conflicts
    if (data.code) {
      const existingCoupon = await db.query.coupons.findFirst({
        where: eq(coupons.code, data.code),
      });

      if (existingCoupon && existingCoupon.id !== id) {
        throw new ConflictError(`Coupon with code "${data.code}" already exists`);
      }
    }

    return await db.transaction(async (tx) => {
      // Update coupon
      const updateData: any = { ...data };
      delete updateData.mappings; // Remove mappings from update data
      updateData.updatedAt = new Date();

      await tx
        .update(coupons)
        .set(updateData)
        .where(eq(coupons.id, id));

      // Update mappings if provided
      if (data.mappings) {
        // Delete existing mappings
        await tx.delete(couponMappings).where(eq(couponMappings.couponId, id));

        // Create new mappings
        const mappingInserts: any[] = [];

        if (data.mappings.cityIds?.length) {
          for (const cityId of data.mappings.cityIds) {
            mappingInserts.push({
              id: uuidv4(),
              couponId: id,
              cityId,
            });
          }
        }

        if (data.mappings.hotelIds?.length) {
          for (const hotelId of data.mappings.hotelIds) {
            mappingInserts.push({
              id: uuidv4(),
              couponId: id,
              hotelId,
            });
          }
        }

        if (data.mappings.roomTypeIds?.length) {
          for (const roomTypeId of data.mappings.roomTypeIds) {
            mappingInserts.push({
              id: uuidv4(),
              couponId: id,
              roomTypeId,
            });
          }
        }

        if (mappingInserts.length > 0) {
          await tx.insert(couponMappings).values(mappingInserts);
        }
      }

      return id;
    });
  }

  // Delete coupon
  async deleteCoupon(id: string) {
    const db = this.fastify.db;

    // Check if coupon exists
    await this.getCouponById(id);

    return await db.transaction(async (tx) => {
      // Delete mappings first
      await tx.delete(couponMappings).where(eq(couponMappings.couponId, id));

      // Delete coupon
      await tx.delete(coupons).where(eq(coupons.id, id));

      return true;
    });
  }

  // Get all coupons for users (no permission restrictions)
  // Get all coupons for users (no permission restrictions)
  async getUserCoupons(filters: CouponFilters = {}, userId, hotelId?: string) {
    const db = this.fastify.db;
    const { status, page = 1, limit = 10 } = filters;

    let whereConditions = [];

    // Add status filter if provided
    if (status) {
      whereConditions.push(eq(coupons.status, status));
    }

    // Add condition to exclude coupons that have reached their usage limit
    // Only show coupons where usageLimit is null (unlimited) OR usedCount < usageLimit
    whereConditions.push(
      or(
        isNull(coupons.usageLimit),
        lt(coupons.usedCount, coupons.usageLimit)
      )
    );

    const whereCondition = whereConditions.length > 1
      ? and(...whereConditions)
      : whereConditions[0];

    // First get all available coupons (not maxed out)
    let couponList = await db.query.coupons.findMany({
      where: whereCondition,
      with: {
        mappings: {
          with: {
            city: true,
            hotel: true,
            roomType: true,
          },
        },
      },
      orderBy: [desc(coupons.createdAt)],
      limit,
      offset: (page - 1) * limit,
    });

    couponList = couponList.filter(coupon => new Date(coupon.validTo) > new Date())

    // If hotelId is provided, filter coupons based on hotel mappings
    if (hotelId) {
      const hotel = await db.query.hotels.findFirst({
        where: eq(hotels.id, hotelId),
        with: {
          rooms: {
            columns: {
              roomTypeId: true
            }
          }
        }
      });

      if (hotel) {
        couponList = await this.filterCouponsByHotelMapping(couponList, { ...hotel, roomTypes: hotel.rooms.map(room => room.roomTypeId) });
      }
    }

    // Get coupon IDs that this user has used
    const usedCouponIds = await db.query.couponUsages.findMany({
      where: eq(couponUsages.userId, userId),
      columns: {
        couponId: true,
      },
    });

    const usedCouponIdSet = new Set(usedCouponIds.map(usage => usage.couponId));

    // Get total count (with same filters)
    const totalCoupons = await db.query.coupons.findMany({
      where: whereCondition,
    });

    return {
      coupons: couponList.map(coupon => ({
        id: coupon.id,
        code: coupon.code,
        description: coupon.description,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        maxDiscountAmount: coupon.maxDiscountAmount,
        minOrderAmount: coupon.minOrderAmount,
        validFrom: coupon.validFrom,
        validTo: coupon.validTo,
        usageLimit: coupon.usageLimit,
        usedCount: coupon.usedCount,
        remainingUses: coupon.usageLimit ? coupon.usageLimit - coupon.usedCount : null,
        status: coupon.status,
        isUsed: usedCouponIdSet.has(coupon.id), // Check if user has used this coupon
        mappings: {
          cities: coupon.mappings.filter(m => m.cityId).map(m => ({
            id: m.city?.id,
            name: m.city?.name,
            state: m.city?.state,
          })),
          hotels: coupon.mappings.filter(m => m.hotelId).map(m => ({
            id: m.hotel?.id,
            name: m.hotel?.name,
            city: m.hotel?.city,
          })),
          roomTypes: coupon.mappings.filter(m => m.roomTypeId).map(m => ({
            id: m.roomType?.id,
            name: m.roomType?.name,
          })),
        },
      })),
      total: totalCoupons.length,
      page,
      limit,
      totalPages: Math.ceil(totalCoupons.length / limit),
    };
  }

  // Helper method to filter coupons based on booking mapping
  private async filterCouponsByBookingMapping(couponList: any[], booking: any) {
    const db = this.fastify.db;

    const filteredCoupons = [];

    for (const coupon of couponList) {
      // If no mappings exist, coupon is valid for all
      if (!coupon.mappings || coupon.mappings.length === 0) {
        filteredCoupons.push(coupon);
        continue;
      }

      let isValidForBooking = false;

      // Check each mapping
      for (const mapping of coupon.mappings) {
        // Direct hotel match
        if (mapping.hotelId && mapping.hotelId === booking.hotelId) {
          isValidForBooking = true;
          break;
        }

        // Direct room type match
        if (mapping.roomTypeId && mapping.roomTypeId === booking.room.roomType) {
          isValidForBooking = true;
          break;
        }

        // City mapping - check hotel's city
        if (mapping.cityId && booking.hotel.cityId === mapping.cityId) {
          isValidForBooking = true;
          break;
        }
      }

      if (isValidForBooking) {
        filteredCoupons.push(coupon);
      }
    }

    return filteredCoupons;
  }

  // Helper method to filter coupons based on hotel mapping
  private async filterCouponsByHotelMapping(couponList: any[], hotel: any) {
    const filteredCoupons = [];

    console.log('couponList ', couponList)
    console.log('hotel ', hotel)
    for (const coupon of couponList) {
      // If no mappings exist, coupon is valid for all
      if (!coupon.mappings || coupon.mappings.length === 0) {
        // filteredCoupons.push(coupon);
        continue;
      }

      let isValidForHotel = false;

      // Check each mapping
      for (const mapping of coupon.mappings) {
        // Direct hotel match
        if (mapping.hotelId && mapping.hotelId === hotel.id) {
          isValidForHotel = true;
          break;
        }

        // City mapping - check hotel's city
        if (mapping.cityId && hotel.cityId === mapping.cityId) {
          isValidForHotel = true;
          break;
        }
        if (mapping.roomTypeId && hotel.roomTypes.includes(mapping.roomTypeId)) {
          isValidForHotel = true;
          break;
        }
      }

      if (isValidForHotel) {
        filteredCoupons.push(coupon);
      }
    }

    return filteredCoupons;
  }

  // Validate coupon for booking with bookingId support
  async validateCoupon(code: string, hotelId: string, roomTypeId: string, orderAmount: number, userId: string, bookingType: 'daily' | 'hourly' = 'daily', bookingId?: string) {
    const db = this.fastify.db;

    const coupon = await db.query.coupons.findFirst({
      where: eq(coupons.code, code),
      with: {
        mappings: true,
      },
    });

    console.log('coupon is ', coupon);

    if (!coupon) {
      throw new NotFoundError(`Coupon with code "${code}" not found`);
    }

    console.log('came 4');
    // Check if coupon is active
    if (coupon.status !== 'active') {
      throw new Error('Coupon is not active');
    }

    console.log('came 5');
    // Check if user has already used this coupon
    // Ensure both values are strings and not null/undefined
    const safeCouponId = coupon.id ? String(coupon.id) : null;
    const safeUserId = userId ? String(userId) : null;

    console.log('coupn id is ', coupon.id)
    console.log('userid is ', userId)
    if (!safeCouponId || !safeUserId) {
      throw new Error('Invalid coupon ID or user ID');
    }

    // Check if user has already used this coupon
    const existingUsage = await db.query.couponUsages.findFirst({
      where: and(
        eq(couponUsages.couponId, safeCouponId),
        eq(couponUsages.userId, safeUserId)
      ),
    });

    console.log('existingUsage ', existingUsage);

    console.log('existingUsage ', existingUsage);

    if (existingUsage) {
      throw new BadRequestError('You have already used this coupon');
    }

    // Check validity dates - Simplified approach
    const now = new Date();

    // Ensure we're working with Date objects
    const validFrom = coupon.validFrom instanceof Date ? coupon.validFrom : new Date(coupon.validFrom);
    const validTo = coupon.validTo instanceof Date ? coupon.validTo : new Date(coupon.validTo);

    console.log('Date comparison:', {
      now: now.toISOString(),
      validFrom: validFrom.toISOString(),
      validTo: validTo.toISOString()
    });

    if (now < validFrom || now > validTo) {
      console.log('coupon time is up');
      throw new Error('Coupon is not valid for current date');
    }

    // Check usage limit
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      console.log('coupon usage up');
      throw new Error('Coupon usage limit exceeded');
    }

    // Check minimum order amount
    if (orderAmount < coupon.minOrderAmount) {
      console.log('Minimum order amount not reached');
      throw new Error(`Minimum order amount of ₹${coupon.minOrderAmount} required`);
    }

    console.log('came here');
    // Check booking type applicability
    if (coupon.applicableBookingTypes !== 'both') {
      if (coupon.applicableBookingTypes !== bookingType) {
        throw new Error(`Coupon is only applicable for ${coupon.applicableBookingTypes} bookings`);
      }
    }

    // Check mappings - improved logic with booking support
    let isValidForHotel = false;
    let actualHotelId = hotelId;
    let actualRoomTypeId = roomTypeId;
    let actualCityId = null;

    if (hotelId) {

      console.log('hotelId ', hotelId)
      try {
        const hotel = await db.query.hotels.findFirst({
          where: eq(hotels.id, hotelId),

        });

        if (hotel) {

          actualCityId = hotel.cityId;
        }
        console.log('hotel is ', hotel)
      } catch (error) {
        console.error('Error fetching hotel details:', error);
        // Continue with provided hotelId and roomTypeId
      }

    }


    console.log('actualRoomTypeId ', actualRoomTypeId)

    console.log('mappings ', coupon.mappings)

    // Check each mapping
    for (const mapping of coupon.mappings) {
      // Direct hotel match
      if (mapping.hotelId && mapping.hotelId === actualHotelId) {
        isValidForHotel = true;
        break;
      }

      // Direct room type match
      if (mapping.roomTypeId && mapping.roomTypeId === actualRoomTypeId) {
        isValidForHotel = true;
        console.log('came here success')
        break;
      }

      // City mapping - use actual city from booking or fetch from hotel
      if (mapping.cityId) {
        try {
          let cityIdToCheck = actualCityId;

          // If we don't have cityId from booking, fetch it from hotel
          if (!cityIdToCheck) {
            const hotel = await db.query.hotels.findFirst({
              where: eq(hotels.id, actualHotelId.toString()),
              columns: { cityId: true }
            });
            cityIdToCheck = hotel?.cityId;
          }

          if (cityIdToCheck && cityIdToCheck === mapping.cityId) {
            isValidForHotel = true;
            break;
          }
        } catch (error) {
          console.error('Error checking hotel city mapping:', error);
          // Continue to next mapping instead of failing completely
          continue;
        }
      }
    }


    if (!isValidForHotel) {
      console.log('it is not valid hotel');
      throw new Error('Coupon is not valid for this hotel or room type');
    }

    console.log('came butone ',coupon)
    console.log('orderAmount ',orderAmount)
    // Calculate discount
    let discountAmount = 0;
    if (coupon.discountType === 'percentage') {
      discountAmount = (orderAmount * coupon.discountValue) / 100;
      if (coupon.maxDiscountAmount && discountAmount > coupon.maxDiscountAmount) {
        discountAmount = coupon.maxDiscountAmount;
      }
    } else {
      discountAmount = coupon.discountValue;
    }

    console.log('here issue')
    // Ensure discount doesn't exceed order amount
    discountAmount = Math.min(discountAmount, orderAmount);

    return {
      coupon: {
        id: coupon.id,
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
      },
      discountAmount,
      finalAmount: Math.max(orderAmount - discountAmount, 0),
    };
  }
}