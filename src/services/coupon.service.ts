// @ts-nocheck
import { FastifyInstance } from "fastify";
import { coupons, couponMappings, cities, hotels, roomTypes } from "../models/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
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
  async getUserCoupons(filters: CouponFilters = {}) {
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
        status: coupon.status,
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

  // Validate coupon for booking
  async validateCoupon(code: string, hotelId: string, roomTypeId: string, orderAmount: number) {
    const db = this.fastify.db;
    
    const coupon = await db.query.coupons.findFirst({
      where: eq(coupons.code, code),
      with: {
        mappings: true,
      },
    });

    if (!coupon) {
      throw new NotFoundError(`Coupon with code "${code}" not found`);
    }

    // Check if coupon is active
    if (coupon.status !== 'active') {
      throw new Error('Coupon is not active');
    }

    // Check validity dates
    const now = new Date();
    if (now < coupon.validFrom || now > coupon.validTo) {
      throw new Error('Coupon is not valid for current date');
    }

    // Check usage limit
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      throw new Error('Coupon usage limit exceeded');
    }

    // Check minimum order amount
    if (orderAmount < coupon.minOrderAmount) {
      throw new Error(`Minimum order amount of ₹${coupon.minOrderAmount} required`);
    }

    // Check mappings
    const isValidForHotel = coupon.mappings.some(mapping => 
      mapping.hotelId === hotelId || 
      mapping.roomTypeId === roomTypeId ||
      mapping.cityId // City mapping would need hotel's city check
    );

    if (!isValidForHotel) {
      throw new Error('Coupon is not valid for this hotel or room type');
    }

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

    return {
      coupon: {
        id: coupon.id,
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
      },
      discountAmount,
      finalAmount: orderAmount - discountAmount,
    };
  }
}
