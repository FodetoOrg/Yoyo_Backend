// @ts-nocheck
import { FastifyInstance } from "fastify";
import { priceAdjustments, rooms, hotels, cities, roomTypes } from "../models/schema";
import { eq, and, desc, inArray, between } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { NotFoundError } from "../types/errors";

interface PriceAdjustmentCreateParams {
  cities?: string[];
  hotels?: string[];
  roomTypes?: string[];
  adjustmentType: 'percentage' | 'fixed';
  adjustmentValue: number;
  reason?: string;
  effectiveDate: Date;
  expiryDate?: Date;
}

interface PriceAdjustmentFilters {
  status?: string;
  page?: number;
  limit?: number;
}

export class PricingService {
  private fastify!: FastifyInstance;

  setFastify(fastify: FastifyInstance) {
    this.fastify = fastify;
  }

  // Create price adjustment
  async createPriceAdjustment(data: PriceAdjustmentCreateParams) {
    const db = this.fastify.db;
    const adjustmentId = uuidv4();

    await db.insert(priceAdjustments).values({
      id: adjustmentId,
      cities: data.cities ? JSON.stringify(data.cities) : null,
      hotels: data.hotels ? JSON.stringify(data.hotels) : null,
      roomTypes: data.roomTypes ? JSON.stringify(data.roomTypes) : null,
      adjustmentType: data.adjustmentType,
      adjustmentValue: data.adjustmentValue,
      reason: data.reason,
      effectiveDate: data.effectiveDate,
      expiryDate: data.expiryDate,
    });

    // Apply the adjustment to affected rooms
    await this.applyPriceAdjustment(adjustmentId);

    return await this.getPriceAdjustmentById(adjustmentId);
  }

  // Get price adjustment by ID
  async getPriceAdjustmentById(id: string) {
    const db = this.fastify.db;
    
    const adjustment = await db.query.priceAdjustments.findFirst({
      where: eq(priceAdjustments.id, id),
    });

    if (!adjustment) {
      throw new NotFoundError(`Price adjustment with id ${id} not found`);
    }

    return {
      id: adjustment.id,
      cities: adjustment.cities ? JSON.parse(adjustment.cities) : [],
      hotels: adjustment.hotels ? JSON.parse(adjustment.hotels) : [],
      roomTypes: adjustment.roomTypes ? JSON.parse(adjustment.roomTypes) : [],
      adjustmentType: adjustment.adjustmentType,
      adjustmentValue: adjustment.adjustmentValue,
      reason: adjustment.reason,
      effectiveDate: adjustment.effectiveDate,
      expiryDate: adjustment.expiryDate,
      status: adjustment.status,
      createdAt: adjustment.createdAt,
      updatedAt: adjustment.updatedAt,
    };
  }

  // Get price adjustment history
  async getPriceAdjustmentHistory(filters: PriceAdjustmentFilters = {}) {
    const db = this.fastify.db;
    const { status, page = 1, limit = 10 } = filters;

    let whereCondition = status ? eq(priceAdjustments.status, status) : undefined;

    const adjustmentList = await db.query.priceAdjustments.findMany({
      where: whereCondition,
      orderBy: [desc(priceAdjustments.createdAt)],
      limit,
      offset: (page - 1) * limit,
    });

    // Get total count
    const totalAdjustments = await db.query.priceAdjustments.findMany({
      where: whereCondition,
    });

    return {
      adjustments: adjustmentList.map(adjustment => ({
        id: adjustment.id,
        cities: adjustment.cities ? JSON.parse(adjustment.cities) : [],
        hotels: adjustment.hotels ? JSON.parse(adjustment.hotels) : [],
        roomTypes: adjustment.roomTypes ? JSON.parse(adjustment.roomTypes) : [],
        adjustmentType: adjustment.adjustmentType,
        adjustmentValue: adjustment.adjustmentValue,
        reason: adjustment.reason,
        effectiveDate: adjustment.effectiveDate,
        expiryDate: adjustment.expiryDate,
        status: adjustment.status,
        createdAt: adjustment.createdAt,
        updatedAt: adjustment.updatedAt,
      })),
      total: totalAdjustments.length,
      page,
      limit,
      totalPages: Math.ceil(totalAdjustments.length / limit),
    };
  }

  // Apply price adjustment to rooms
  private async applyPriceAdjustment(adjustmentId: string) {
    const db = this.fastify.db;
    
    const adjustment = await this.getPriceAdjustmentById(adjustmentId);
    
    // Build conditions to find affected rooms
    let affectedRooms: any[] = [];

    // If cities are specified
    if (adjustment.cities.length > 0) {
      const cityHotels = await db.query.hotels.findMany({
        where: inArray(hotels.city, adjustment.cities),
      });
      
      const hotelIds = cityHotels.map(h => h.id);
      if (hotelIds.length > 0) {
        const cityRooms = await db.query.rooms.findMany({
          where: inArray(rooms.hotelId, hotelIds),
        });
        affectedRooms.push(...cityRooms);
      }
    }

    // If hotels are specified
    if (adjustment.hotels.length > 0) {
      const hotelRooms = await db.query.rooms.findMany({
        where: inArray(rooms.hotelId, adjustment.hotels),
      });
      affectedRooms.push(...hotelRooms);
    }

    // If room types are specified
    if (adjustment.roomTypes.length > 0) {
      const roomTypeRooms = await db.query.rooms.findMany({
        where: inArray(rooms.roomTypeId, adjustment.roomTypes),
      });
      affectedRooms.push(...roomTypeRooms);
    }

    // Remove duplicates
    const uniqueRooms = affectedRooms.filter((room, index, self) => 
      index === self.findIndex(r => r.id === room.id)
    );

    // Apply adjustment to each room
    for (const room of uniqueRooms) {
      let newPricePerNight = room.pricePerNight;
      let newPricePerHour = room.pricePerHour;

      if (adjustment.adjustmentType === 'percentage') {
        newPricePerNight = room.pricePerNight * (1 + adjustment.adjustmentValue / 100);
        if (room.pricePerHour) {
          newPricePerHour = room.pricePerHour * (1 + adjustment.adjustmentValue / 100);
        }
      } else {
        newPricePerNight = room.pricePerNight + adjustment.adjustmentValue;
        if (room.pricePerHour) {
          newPricePerHour = room.pricePerHour + adjustment.adjustmentValue;
        }
      }

      // Update room prices
      await db
        .update(rooms)
        .set({
          pricePerNight: Math.max(0, newPricePerNight), // Ensure price doesn't go negative
          pricePerHour: newPricePerHour ? Math.max(0, newPricePerHour) : null,
          updatedAt: new Date(),
        })
        .where(eq(rooms.id, room.id));
    }

    return {
      adjustmentId,
      affectedRoomsCount: uniqueRooms.length,
    };
  }

  // Update price adjustment
  async updatePriceAdjustment(id: string, data: Partial<PriceAdjustmentCreateParams>) {
    const db = this.fastify.db;
    
    // Check if adjustment exists
    await this.getPriceAdjustmentById(id);

    const updateData: any = { ...data };
    
    if (data.cities) {
      updateData.cities = JSON.stringify(data.cities);
    }
    if (data.hotels) {
      updateData.hotels = JSON.stringify(data.hotels);
    }
    if (data.roomTypes) {
      updateData.roomTypes = JSON.stringify(data.roomTypes);
    }
    
    updateData.updatedAt = new Date();

    await db
      .update(priceAdjustments)
      .set(updateData)
      .where(eq(priceAdjustments.id, id));

    return await this.getPriceAdjustmentById(id);
  }

  // Delete price adjustment
  async deletePriceAdjustment(id: string) {
    const db = this.fastify.db;
    
    // Check if adjustment exists
    await this.getPriceAdjustmentById(id);

    await db.delete(priceAdjustments).where(eq(priceAdjustments.id, id));
    return true;
  }

  // Get current effective price for a room
  async getEffectivePrice(roomId: string, bookingDate: Date = new Date()) {
    const db = this.fastify.db;
    
    const room = await db.query.rooms.findFirst({
      where: eq(rooms.id, roomId),
      with: {
        hotel: true,
        roomType: true,
      },
    });

    if (!room) {
      throw new NotFoundError(`Room with id ${roomId} not found`);
    }

    // Get active price adjustments that affect this room
    const activeAdjustments = await db.query.priceAdjustments.findMany({
      where: and(
        eq(priceAdjustments.status, 'active'),
        between(priceAdjustments.effectiveDate, bookingDate, bookingDate)
      ),
    });

    let effectivePricePerNight = room.pricePerNight;
    let effectivePricePerHour = room.pricePerHour;

    // Apply adjustments
    for (const adjustment of activeAdjustments) {
      const cities = adjustment.cities ? JSON.parse(adjustment.cities) : [];
      const hotels = adjustment.hotels ? JSON.parse(adjustment.hotels) : [];
      const roomTypes = adjustment.roomTypes ? JSON.parse(adjustment.roomTypes) : [];

      // Check if this adjustment applies to this room
      const appliesTo = 
        cities.includes(room.hotel.city) ||
        hotels.includes(room.hotelId) ||
        (room.roomTypeId && roomTypes.includes(room.roomTypeId));

      if (appliesTo) {
        if (adjustment.adjustmentType === 'percentage') {
          effectivePricePerNight *= (1 + adjustment.adjustmentValue / 100);
          if (effectivePricePerHour) {
            effectivePricePerHour *= (1 + adjustment.adjustmentValue / 100);
          }
        } else {
          effectivePricePerNight += adjustment.adjustmentValue;
          if (effectivePricePerHour) {
            effectivePricePerHour += adjustment.adjustmentValue;
          }
        }
      }
    }

    return {
      roomId: room.id,
      originalPricePerNight: room.pricePerNight,
      originalPricePerHour: room.pricePerHour,
      effectivePricePerNight: Math.max(0, effectivePricePerNight),
      effectivePricePerHour: effectivePricePerHour ? Math.max(0, effectivePricePerHour) : null,
      appliedAdjustments: activeAdjustments.length,
    };
  }
}