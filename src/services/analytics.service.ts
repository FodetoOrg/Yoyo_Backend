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
    const db = this.fastify.db;
    
    // Get current date ranges
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // Total counts
    const totalHotels = await db.select({ count: count() }).from(hotels);
    const totalUsers = await db.select({ count: count() }).from(users).where(eq(users.role, 'user'));
    const totalBookings = await db.select({ count: count() }).from(bookings);
    const totalRooms = await db.select({ count: count() }).from(rooms);

    // Monthly revenue
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

    const lastMonthRevenue = await db
      .select({ 
        total: sum(bookings.totalAmount) 
      })
      .from(bookings)
      .where(
        and(
          eq(bookings.status, 'completed'),
          eq(bookings.paymentStatus, 'completed'),
          between(bookings.createdAt, startOfLastMonth, endOfLastMonth)
        )
      );

    // Monthly bookings
    const monthlyBookings = await db
      .select({ count: count() })
      .from(bookings)
      .where(between(bookings.createdAt, startOfMonth, now));

    const lastMonthBookings = await db
      .select({ count: count() })
      .from(bookings)
      .where(between(bookings.createdAt, startOfLastMonth, endOfLastMonth));

    // Top performing hotels
    const topHotels = await db
      .select({
        hotelId: bookings.hotelId,
        hotelName: hotels.name,
        totalRevenue: sum(bookings.totalAmount),
        totalBookings: count(bookings.id),
      })
      .from(bookings)
      .innerJoin(hotels, eq(bookings.hotelId, hotels.id))
      .where(
        and(
          eq(bookings.status, 'completed'),
          between(bookings.createdAt, startOfMonth, now)
        )
      )
      .groupBy(bookings.hotelId, hotels.name)
      .orderBy(desc(sum(bookings.totalAmount)))
      .limit(5);

    // City-wise analytics
    const cityAnalytics = await db
      .select({
        city: hotels.city,
        totalHotels: count(hotels.id),
        totalBookings: count(bookings.id),
        totalRevenue: sum(bookings.totalAmount),
      })
      .from(hotels)
      .leftJoin(bookings, and(
        eq(hotels.id, bookings.hotelId),
        eq(bookings.status, 'completed'),
        between(bookings.createdAt, startOfMonth, now)
      ))
      .groupBy(hotels.city)
      .orderBy(desc(sum(bookings.totalAmount)));

    // Recent bookings
    const recentBookings = await db.query.bookings.findMany({
      with: {
        hotel: true,
        user: true,
      },
      orderBy: [desc(bookings.createdAt)],
      limit: 10,
    });

    return {
      overview: {
        totalHotels: totalHotels[0]?.count || 0,
        totalUsers: totalUsers[0]?.count || 0,
        totalBookings: totalBookings[0]?.count || 0,
        totalRooms: totalRooms[0]?.count || 0,
        monthlyRevenue: monthlyRevenue[0]?.total || 0,
        lastMonthRevenue: lastMonthRevenue[0]?.total || 0,
        monthlyBookings: monthlyBookings[0]?.count || 0,
        lastMonthBookings: lastMonthBookings[0]?.count || 0,
      },
      topHotels: topHotels.map(hotel => ({
        hotelId: hotel.hotelId,
        name: hotel.hotelName,
        revenue: hotel.totalRevenue || 0,
        bookings: hotel.totalBookings || 0,
      })),
      cityAnalytics: cityAnalytics.map(city => ({
        city: city.city,
        hotels: city.totalHotels || 0,
        bookings: city.totalBookings || 0,
        revenue: city.totalRevenue || 0,
      })),
      recentBookings: recentBookings.map(booking => ({
        id: booking.id,
        checkInDate: booking.checkInDate,
        checkOutDate: booking.checkOutDate,
        totalAmount: booking.totalAmount,
        status: booking.status,
        hotel: {
          name: booking.hotel.name,
          city: booking.hotel.city,
        },
        user: {
          name: booking.user.name,
          phone: booking.user.phone,
        },
      })),
    };
  }

  // Hotel-specific dashboard analytics
  private async getHotelDashboard(hotelId: string) {
    const db = this.fastify.db;
    
    // Get current date ranges
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // Hotel basic info
    const hotel = await db.query.hotels.findFirst({
      where: eq(hotels.id, hotelId),
    });

    // Total rooms
    const totalRooms = await db
      .select({ count: count() })
      .from(rooms)
      .where(eq(rooms.hotelId, hotelId));

    // Available rooms
    const availableRooms = await db
      .select({ count: count() })
      .from(rooms)
      .where(and(
        eq(rooms.hotelId, hotelId),
        eq(rooms.status, 'available')
      ));

    // Monthly bookings
    const monthlyBookings = await db
      .select({ count: count() })
      .from(bookings)
      .where(and(
        eq(bookings.hotelId, hotelId),
        between(bookings.createdAt, startOfMonth, now)
      ));

    const lastMonthBookings = await db
      .select({ count: count() })
      .from(bookings)
      .where(and(
        eq(bookings.hotelId, hotelId),
        between(bookings.createdAt, startOfLastMonth, endOfLastMonth)
      ));

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

    const lastMonthRevenue = await db
      .select({ total: sum(bookings.totalAmount) })
      .from(bookings)
      .where(and(
        eq(bookings.hotelId, hotelId),
        eq(bookings.status, 'completed'),
        eq(bookings.paymentStatus, 'completed'),
        between(bookings.createdAt, startOfLastMonth, endOfLastMonth)
      ));

    // Occupancy rate
    const occupiedRooms = await db
      .select({ count: count() })
      .from(rooms)
      .where(and(
        eq(rooms.hotelId, hotelId),
        eq(rooms.status, 'occupied')
      ));

    const occupancyRate = totalRooms[0]?.count > 0 
      ? ((occupiedRooms[0]?.count || 0) / totalRooms[0].count) * 100 
      : 0;

    // Recent bookings
    const recentBookings = await db.query.bookings.findMany({
      where: eq(bookings.hotelId, hotelId),
      with: {
        user: true,
        room: true,
      },
      orderBy: [desc(bookings.createdAt)],
      limit: 10,
    });

    // Room performance
    const roomPerformance = await db
      .select({
        roomId: bookings.roomId,
        roomName: rooms.name,
        roomNumber: rooms.roomNumber,
        totalBookings: count(bookings.id),
        totalRevenue: sum(bookings.totalAmount),
      })
      .from(bookings)
      .innerJoin(rooms, eq(bookings.roomId, rooms.id))
      .where(and(
        eq(bookings.hotelId, hotelId),
        eq(bookings.status, 'completed'),
        between(bookings.createdAt, startOfMonth, now)
      ))
      .groupBy(bookings.roomId, rooms.name, rooms.roomNumber)
      .orderBy(desc(sum(bookings.totalAmount)));

    return {
      hotel: {
        id: hotel?.id,
        name: hotel?.name,
        city: hotel?.city,
        address: hotel?.address,
      },
      overview: {
        totalRooms: totalRooms[0]?.count || 0,
        availableRooms: availableRooms[0]?.count || 0,
        occupiedRooms: occupiedRooms[0]?.count || 0,
        occupancyRate: Math.round(occupancyRate * 100) / 100,
        monthlyBookings: monthlyBookings[0]?.count || 0,
        lastMonthBookings: lastMonthBookings[0]?.count || 0,
        monthlyRevenue: monthlyRevenue[0]?.total || 0,
        lastMonthRevenue: lastMonthRevenue[0]?.total || 0,
      },
      recentBookings: recentBookings.map(booking => ({
        id: booking.id,
        checkInDate: booking.checkInDate,
        checkOutDate: booking.checkOutDate,
        totalAmount: booking.totalAmount,
        status: booking.status,
        guestCount: booking.guestCount,
        user: {
          name: booking.user.name,
          phone: booking.user.phone,
        },
        room: {
          name: booking.room.name,
          roomNumber: booking.room.roomNumber,
        },
      })),
      roomPerformance: roomPerformance.map(room => ({
        roomId: room.roomId,
        name: room.roomName,
        roomNumber: room.roomNumber,
        bookings: room.totalBookings || 0,
        revenue: room.totalRevenue || 0,
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
        city,
        overview: {
          totalHotels: 0,
          totalRooms: 0,
          totalBookings: 0,
          totalRevenue: 0,
        },
        hotels: [],
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

    // Hotel-wise performance
    const hotelPerformance = await db
      .select({
        hotelId: bookings.hotelId,
        hotelName: hotels.name,
        totalBookings: count(bookings.id),
        totalRevenue: sum(bookings.totalAmount),
      })
      .from(bookings)
      .innerJoin(hotels, eq(bookings.hotelId, hotels.id))
      .where(and(
        inArray(bookings.hotelId, hotelIds),
        eq(bookings.status, 'completed')
      ))
      .groupBy(bookings.hotelId, hotels.name)
      .orderBy(desc(sum(bookings.totalAmount)));

    return {
      city,
      overview: {
        totalHotels: cityHotels.length,
        totalRooms: totalRooms[0]?.count || 0,
        totalBookings: totalBookings[0]?.count || 0,
        totalRevenue: totalRevenue[0]?.total || 0,
      },
      hotels: hotelPerformance.map(hotel => ({
        hotelId: hotel.hotelId,
        name: hotel.hotelName,
        bookings: hotel.totalBookings || 0,
        revenue: hotel.totalRevenue || 0,
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