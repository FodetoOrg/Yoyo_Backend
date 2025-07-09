import { FastifyInstance } from "fastify";
import { revenueRecords, hotels, bookings } from "../models/schema";
import { eq, and, desc, between, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { NotFoundError } from "../types/errors";

interface RevenueFilters {
  status?: string;
  period?: string;
  hotelId?: string;
  page?: number;
  limit?: number;
}

export class RevenueService {
  private fastify!: FastifyInstance;

  setFastify(fastify: FastifyInstance) {
    this.fastify = fastify;
  }

  // Get revenue records with filters
  async getRevenueRecords(filters: RevenueFilters = {}) {
    const db = this.fastify.db;
    const { status, period, hotelId, page = 1, limit = 10 } = filters;

    let whereConditions: any[] = [];

    if (status) {
      whereConditions.push(eq(revenueRecords.status, status));
    }

    if (period) {
      whereConditions.push(eq(revenueRecords.period, period));
    }

    if (hotelId) {
      whereConditions.push(eq(revenueRecords.hotelId, hotelId));
    }

    const records = await db.query.revenueRecords.findMany({
      where: whereConditions.length > 0 ? and(...whereConditions) : undefined,
      with: {
        hotel: true,
      },
      orderBy: [desc(revenueRecords.createdAt)],
      limit,
      offset: (page - 1) * limit,
    });

    // Get total count
    const totalRecords = await db.query.revenueRecords.findMany({
      where: whereConditions.length > 0 ? and(...whereConditions) : undefined,
    });

    return {
      records: records.map(record => ({
        id: record.id,
        hotelId: record.hotelId,
        period: record.period,
        totalRevenue: record.totalRevenue,
        commissionRate: record.commissionRate,
        commissionAmount: record.commissionAmount,
        payableAmount: record.payableAmount,
        status: record.status,
        dueDate: record.dueDate,
        paidDate: record.paidDate,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        hotel: {
          id: record.hotel.id,
          name: record.hotel.name,
          city: record.hotel.city,
          commissionRate: record.hotel.commissionRate,
        },
      })),
      total: totalRecords.length,
      page,
      limit,
      totalPages: Math.ceil(totalRecords.length / limit),
    };
  }

  // Get revenue record by ID
  async getRevenueRecordById(id: string) {
    const db = this.fastify.db;
    
    const record = await db.query.revenueRecords.findFirst({
      where: eq(revenueRecords.id, id),
      with: {
        hotel: true,
      },
    });

    if (!record) {
      throw new NotFoundError(`Revenue record with id ${id} not found`);
    }

    return {
      id: record.id,
      hotelId: record.hotelId,
      period: record.period,
      totalRevenue: record.totalRevenue,
      commissionRate: record.commissionRate,
      commissionAmount: record.commissionAmount,
      payableAmount: record.payableAmount,
      status: record.status,
      dueDate: record.dueDate,
      paidDate: record.paidDate,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      hotel: {
        id: record.hotel.id,
        name: record.hotel.name,
        city: record.hotel.city,
        address: record.hotel.address,
        commissionRate: record.hotel.commissionRate,
      },
    };
  }

  // Generate revenue records for a specific period
  async generateRevenueRecords(period: string) {
    const db = this.fastify.db;
    
    // Parse period (YYYY-MM format)
    const [year, month] = period.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    // Get all hotels
    const allHotels = await db.query.hotels.findMany();

    const generatedRecords = [];

    for (const hotel of allHotels) {
      // Check if record already exists for this period
      const existingRecord = await db.query.revenueRecords.findFirst({
        where: and(
          eq(revenueRecords.hotelId, hotel.id),
          eq(revenueRecords.period, period)
        ),
      });

      if (existingRecord) {
        continue; // Skip if already exists
      }

      // Calculate total revenue for this hotel in this period
      const hotelBookings = await db.query.bookings.findMany({
        where: and(
          eq(bookings.hotelId, hotel.id),
          eq(bookings.status, 'completed'),
          eq(bookings.paymentStatus, 'completed'),
          between(bookings.createdAt, startDate, endDate)
        ),
      });

      const totalRevenue = hotelBookings.reduce((sum, booking) => sum + booking.totalAmount, 0);

      if (totalRevenue > 0) {
        const commissionRate = hotel.commissionRate || 10; // Default 10%
        const commissionAmount = (totalRevenue * commissionRate) / 100;
        const payableAmount = commissionAmount;

        // Set due date (30 days from end of period)
        const dueDate = new Date(endDate);
        dueDate.setDate(dueDate.getDate() + 30);

        const recordId = uuidv4();
        
        await db.insert(revenueRecords).values({
          id: recordId,
          hotelId: hotel.id,
          period,
          totalRevenue,
          commissionRate,
          commissionAmount,
          payableAmount,
          dueDate,
        });

        generatedRecords.push(recordId);
      }
    }

    return {
      period,
      generatedCount: generatedRecords.length,
      recordIds: generatedRecords,
    };
  }

  // Mark revenue record as paid
  async markAsPaid(id: string, paidDate?: Date) {
    const db = this.fastify.db;
    
    // Check if record exists
    await this.getRevenueRecordById(id);

    await db
      .update(revenueRecords)
      .set({
        status: 'paid',
        paidDate: paidDate || new Date(),
        updatedAt: new Date(),
      })
      .where(eq(revenueRecords.id, id));

    return await this.getRevenueRecordById(id);
  }

  // Update revenue record status
  async updateStatus(id: string, status: string) {
    const db = this.fastify.db;
    
    // Check if record exists
    await this.getRevenueRecordById(id);

    const updateData: any = {
      status,
      updatedAt: new Date(),
    };

    // If marking as paid, set paid date
    if (status === 'paid') {
      updateData.paidDate = new Date();
    }

    await db
      .update(revenueRecords)
      .set(updateData)
      .where(eq(revenueRecords.id, id));

    return await this.getRevenueRecordById(id);
  }

  // Get revenue summary
  async getRevenueSummary(hotelId?: string) {
    const db = this.fastify.db;
    
    let whereCondition = hotelId ? eq(revenueRecords.hotelId, hotelId) : undefined;

    const allRecords = await db.query.revenueRecords.findMany({
      where: whereCondition,
    });

    const summary = {
      totalRevenue: 0,
      totalCommission: 0,
      pendingAmount: 0,
      paidAmount: 0,
      overdueAmount: 0,
      recordCount: allRecords.length,
    };

    const now = new Date();

    for (const record of allRecords) {
      summary.totalRevenue += record.totalRevenue;
      summary.totalCommission += record.commissionAmount;

      if (record.status === 'paid') {
        summary.paidAmount += record.payableAmount;
      } else if (record.status === 'pending') {
        if (record.dueDate < now) {
          summary.overdueAmount += record.payableAmount;
        } else {
          summary.pendingAmount += record.payableAmount;
        }
      }
    }

    return summary;
  }
}