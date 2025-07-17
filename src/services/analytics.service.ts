import { FastifyInstance } from "fastify";
import { bookings, hotels, users, payments, rooms, cities } from "../models/schema";
import { eq, and, desc, between, sql, count, sum, inArray } from "drizzle-orm";

interface AnalyticsFilters {
  hotelId?: string;
  cityId?: string;
  startDate?: Date;
  endDate?: Date;
  period?: 'daily' | 'weekly' | 'monthly' | 'yearly';
}

export class AnalyticsService {
  private fastify!: FastifyInstance;

  setFastify(fastify: FastifyInstance) {
    this.fastify = fastify;
  }

  // Get dashboard analytics
  async getDashboardAnalytics(type: 'super' | 'hotel', hotelId?: string) {
    const db = this.fastify.db;
    
    if (type === 'super') {
      return await this.getSuperAdminDashboard();
    } else {
      return await this.getHotelDashboard(hotelId!);
    }
  }

  // Super admin dashboard analytics
  private async getSuperAdminDashboard() {
    console.log('called super')
    const db = this.fastify.db;
    
    // Get current date ranges
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Total counts
    const totalHotels = await db.select({ count: count() }).from(hotels);
    const totalUsers = await db.select({ count: count() }).from(users).where(eq(users.role, 'user'));
    const totalBookings = await db.select({ count: count() }).from(bookings);

    // Monthly revenue (current month)
    const monthlyRevenue = await db
      .select({ 
        total: sum(bookings.totalAmount) 
      })
      .from(bookings)
      .where(
        and(
          eq(bookings.status, 'completed'),
          eq(bookings.paymentStatus, 'completed'),
          between(bookings.createdAt, startOfMonth, now)
        )
      );

    // Get monthly data for the last 12 months
    const monthlyData = [];
    for (let i = 11; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      
      const monthData = await db
        .select({
          sales: count(bookings.id),
          revenue: sum(bookings.totalAmount),
        })
        .from(bookings)
        .where(
          and(
            eq(bookings.status, 'completed'),
            eq(bookings.paymentStatus, 'completed'),
            between(bookings.createdAt, monthStart, monthEnd)
          )
        );

      monthlyData.push({
        date: monthStart.toISOString().substring(0, 7), // Format: "2024-01"
        sales: Number(monthData[0]?.sales || 0),
        revenue: Number(monthData[0]?.revenue || 0),
        profit: Math.round(Number(monthData[0]?.revenue || 0) * 0.5), // Assuming 50% profit margin
      });
    }

    // Booking status counts
    const confirmedBookings = await db
      .select({ count: count() })
      .from(bookings)
      .where(eq(bookings.status, 'confirmed'));

    const pendingBookings = await db
      .select({ count: count() })
      .from(bookings)
      .where(eq(bookings.status, 'pending'));

    const cancelledBookings = await db
      .select({ count: count() })
      .from(bookings)
      .where(eq(bookings.status, 'cancelled'));

    // Revenue calculations
    const totalRevenue = await db
      .select({ total: sum(bookings.totalAmount) })
      .from(bookings)
      .where(
        and(
          eq(bookings.status, 'completed'),
          eq(bookings.paymentStatus, 'completed')
        )
      );

    const pendingRevenue = await db
      .select({ total: sum(bookings.totalAmount) })
      .from(bookings)
      .where(eq(bookings.paymentStatus, 'pending'));

    const refundedAmount = await db
      .select({ total: sum(bookings.totalAmount) })
      .from(bookings)
      .where(eq(bookings.paymentStatus, 'refunded'));

    return {
      overview: {
        totalHotels: Number(totalHotels[0]?.count || 0),
        totalUsers: Number(totalUsers[0]?.count || 0),
        totalBookings: Number(totalBookings[0]?.count || 0),
        monthlyRevenue: Number(monthlyRevenue[0]?.total || 0),
        monthlyData: monthlyData,
      },
      bookings: {
        confirmedBookings: Number(confirmedBookings[0]?.count || 0),
        pendingBookings: Number(pendingBookings[0]?.count || 0),
        cancelledBookings: Number(cancelledBookings[0]?.count || 0),
        monthlyData: monthlyData,
      },
      revenue: {
        totalRevenue: Number(totalRevenue[0]?.total || 0),
        pendingRevenue: Number(pendingRevenue[0]?.total || 0),
        refundedAmount: Number(refundedAmount[0]?.total || 0),
      },
    };
  }

  // Hotel-specific dashboard analytics
  private async getHotelDashboard(hotelId: string) {
    const db = this.fastify.db;
    
    // Get current date ranges
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Total rooms
    const totalRooms = await db
      .select({ count: count() })
      .from(rooms)
      .where(eq(rooms.hotelId, hotelId));

    // Occupancy rate
    const occupiedRooms = await db
      .select({ count: count() })
      .from(rooms)
      .where(and(
        eq(rooms.hotelId, hotelId),
        eq(rooms.status, 'occupied')
      ));

    const occupancyRate = totalRooms[0]?.count > 0 
      ? Math.round(((occupiedRooms[0]?.count || 0) / totalRooms[0].count) * 100)
      : 0;

    // Monthly revenue
    const monthlyRevenue = await db
      .select({ total: sum(bookings.totalAmount) })
      .from(bookings)
      .where(and(
        eq(bookings.hotelId, hotelId),
        eq(bookings.status, 'completed'),
        eq(bookings.paymentStatus, 'completed'),
        between(bookings.createdAt, startOfMonth, now)
      ));

    // Get monthly time series data for the last 12 months
    const timeSeriesData = [];
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    for (let i = 11; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      
      const monthData = await db
        .select({
          bookings: count(bookings.id),
          revenue: sum(bookings.totalAmount),
        })
        .from(bookings)
        .where(
          and(
            eq(bookings.hotelId, hotelId),
            eq(bookings.status, 'completed'),
            eq(bookings.paymentStatus, 'completed'),
            between(bookings.createdAt, monthStart, monthEnd)
          )
        );

      // Calculate occupancy for this month
      const monthOccupancy = Math.floor(Math.random() * 20) + 70; // Mock data between 70-90%

      timeSeriesData.push({
        month: months[monthStart.getMonth()],
        bookings: Number(monthData[0]?.bookings || 0),
        revenue: Number(monthData[0]?.revenue || 0),
        occupancy: Number(monthOccupancy),
      });
    }

    // Room type distribution
    const roomTypeDistribution = await db
      .select({
        roomType: rooms.name,
        count: count(rooms.id),
      })
      .from(rooms)
      .where(eq(rooms.hotelId, hotelId))
      .groupBy(rooms.name);

    return {
      overview: {
        totalRooms: Number(totalRooms[0]?.count || 0),
        occupancyRate: Number(occupancyRate),
        monthlyRevenue: Number(monthlyRevenue[0]?.total || 0),
      },
      timeSeriesData: timeSeriesData,
      roomTypeDistribution: roomTypeDistribution.map(room => ({
        name: room.roomType,
        value: Number(room.count || 0),
      })),
    };
  }

  // Get city analytics
  async getCityAnalytics(cityId: string) {
    const db = this.fastify.db;
    
    // Get city info
    const city = await db.query.cities.findFirst({
      where: eq(cities.id, cityId),
    });

    if (!city) {
      throw new Error(`City with id ${cityId} not found`);
    }

    // Get hotels in this city
    const cityHotels = await db.query.hotels.findMany({
      where: eq(hotels.city, city.name),
    });

    const hotelIds = cityHotels.map(h => h.id);

    if (hotelIds.length === 0) {
      return {
        overview: {
          totalHotels: 0,
          totalRooms: 0,
          totalBookings: 0,
          totalRevenue: 0,
        },
        timeSeriesData: [],
        hotelDistribution: [],
      };
    }

    // Get analytics for hotels in this city
    const totalRooms = await db
      .select({ count: count() })
      .from(rooms)
      .where(inArray(rooms.hotelId, hotelIds));

    const totalBookings = await db
      .select({ count: count() })
      .from(bookings)
      .where(inArray(bookings.hotelId, hotelIds));

    const totalRevenue = await db
      .select({ total: sum(bookings.totalAmount) })
      .from(bookings)
      .where(and(
        inArray(bookings.hotelId, hotelIds),
        eq(bookings.status, 'completed'),
        eq(bookings.paymentStatus, 'completed')
      ));

    // Get monthly time series data
    const now = new Date();
    const timeSeriesData = [];
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    for (let i = 11; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      
      const monthData = await db
        .select({
          bookings: count(bookings.id),
          revenue: sum(bookings.totalAmount),
        })
        .from(bookings)
        .where(
          and(
            inArray(bookings.hotelId, hotelIds),
            eq(bookings.status, 'completed'),
            eq(bookings.paymentStatus, 'completed'),
            between(bookings.createdAt, monthStart, monthEnd)
          )
        );

      timeSeriesData.push({
        month: months[monthStart.getMonth()],
        bookings: monthData[0]?.bookings || 0,
        revenue: monthData[0]?.revenue || 0,
      });
    }

    // Hotel distribution by star rating
    const hotelDistribution = await db
      .select({
        starRating: hotels.starRating,
        count: count(hotels.id),
      })
      .from(hotels)
      .where(inArray(hotels.id, hotelIds))
      .groupBy(hotels.starRating);

    return {
      overview: {
        totalHotels: cityHotels.length,
        totalRooms: totalRooms[0]?.count || 0,
        totalBookings: totalBookings[0]?.count || 0,
        totalRevenue: totalRevenue[0]?.total || 0,
      },
      timeSeriesData: timeSeriesData,
      hotelDistribution: hotelDistribution.map(hotel => ({
        name: `${hotel.starRating}‑Star`,
        value: hotel.count || 0,
      })),
    };
  }

  // Get revenue analytics with time series data
  async getRevenueAnalytics(filters: AnalyticsFilters = {}) {
    const db = this.fastify.db;
    const { hotelId, startDate, endDate, period = 'monthly' } = filters;

    // Default to last 12 months if no dates provided
    const defaultEndDate = endDate || new Date();
    const defaultStartDate = startDate || new Date(defaultEndDate.getFullYear() - 1, defaultEndDate.getMonth(), 1);

    let whereConditions: any[] = [
      eq(bookings.status, 'completed'),
      eq(bookings.paymentStatus, 'completed'),
      between(bookings.createdAt, defaultStartDate, defaultEndDate)
    ];

    if (hotelId) {
      whereConditions.push(eq(bookings.hotelId, hotelId));
    }

    // Get time series data based on period
    let timeSeriesData: any[] = [];
    
    if (period === 'daily') {
      // Daily revenue for the selected period
      timeSeriesData = await db
        .select({
          date: sql`DATE(${bookings.createdAt})`,
          revenue: sum(bookings.totalAmount),
          bookings: count(bookings.id),
        })
        .from(bookings)
        .where(and(...whereConditions))
        .groupBy(sql`DATE(${bookings.createdAt})`)
        .orderBy(sql`DATE(${bookings.createdAt})`);
    } else if (period === 'monthly') {
      // Monthly revenue
      timeSeriesData = await db
        .select({
          month: sql`strftime('%Y-%m', ${bookings.createdAt})`,
          revenue: sum(bookings.totalAmount),
          bookings: count(bookings.id),
        })
        .from(bookings)
        .where(and(...whereConditions))
        .groupBy(sql`strftime('%Y-%m', ${bookings.createdAt})`)
        .orderBy(sql`strftime('%Y-%m', ${bookings.createdAt})`);
    }

    return {
      period,
      startDate: defaultStartDate,
      endDate: defaultEndDate,
      timeSeriesData: timeSeriesData.map(item => ({
        period: item.date || item.month,
        revenue: item.revenue || 0,
        bookings: item.bookings || 0,
      })),
    };
  }
}