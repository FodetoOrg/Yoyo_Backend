
// @ts-nocheck
import { FastifyInstance } from "fastify";
import { bookings, hotels, users, payments, rooms, cities } from "../models/schema";
import { eq, and, desc, between, sql, count, sum, inArray, gte, lte } from "drizzle-orm";

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
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);

    // Overview metrics
    const totalCities = await db.select({ count: count() }).from(cities);
    const totalHotels = await db.select({ count: count() }).from(hotels);
    const totalUsers = await db.select({ count: count() }).from(users).where(eq(users.role, 'user'));
    const totalBookings = await db.select({ count: count() }).from(bookings);

    // Total Paid Revenue (confirmed bookings with completed payments)
    const totalPaidRevenue = await db
      .select({ total: sum(bookings.totalAmount) })
      .from(bookings)
      .where(
        and(
          eq(bookings.status, 'confirmed'),
          eq(bookings.paymentStatus, 'completed')
        )
      );

    // Need to Pay Revenue (confirmed bookings with pending payments)
    const needToPayRevenue = await db
      .select({ total: sum(bookings.totalAmount) })
      .from(bookings)
      .where(
        and(
          eq(bookings.status, 'confirmed'),
          eq(bookings.paymentStatus, 'pending')
        )
      );

    // Current month paid revenue
    const currentMonthPaidRevenue = await db
      .select({ total: sum(bookings.totalAmount) })
      .from(bookings)
      .where(
        and(
          eq(bookings.status, 'confirmed'),
          eq(bookings.paymentStatus, 'completed'),
          between(bookings.createdAt, startOfMonth, now)
        )
      );

    // Last month paid revenue
    const lastMonthPaidRevenue = await db
      .select({ total: sum(bookings.totalAmount) })
      .from(bookings)
      .where(
        and(
          eq(bookings.status, 'confirmed'),
          eq(bookings.paymentStatus, 'completed'),
          between(bookings.createdAt, startOfLastMonth, endOfLastMonth)
        )
      );

    // Commission calculation (10% commission)
    const commissionRate = 0.10;
    const totalPaidCommission = (Number(totalPaidRevenue[0]?.total || 0)) * commissionRate;
    const pendingCommission = (Number(needToPayRevenue[0]?.total || 0)) * commissionRate;
    const currentMonthCommission = (Number(currentMonthPaidRevenue[0]?.total || 0)) * commissionRate;

    // Booking distribution
    const confirmedBookings = await db
      .select({ count: count() })
      .from(bookings)
      .where(eq(bookings.status, 'confirmed'));

    const cancelledBookings = await db
      .select({ count: count() })
      .from(bookings)
      .where(eq(bookings.status, 'cancelled'));

    const pendingBookings = await db
      .select({ count: count() })
      .from(bookings)
      .where(eq(bookings.status, 'pending'));

    const completedBookings = await db
      .select({ count: count() })
      .from(bookings)
      .where(eq(bookings.status, 'completed'));

    // User distribution
    const totalCustomers = await db
      .select({ count: count() })
      .from(users)
      .where(eq(users.role, 'user'));

    const totalAdmins = await db
      .select({ count: count() })
      .from(users)
      .where(eq(users.role, 'super_admin'));

    const totalHotelOwners = await db
      .select({ count: count() })
      .from(users)
      .where(eq(users.role, 'hotel_admin'));

    // Last 6 months data
    const last6MonthsData = [];
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      
      // New users this month
      const newUsers = await db
        .select({ count: count() })
        .from(users)
        .where(
          and(
            eq(users.role, 'user'),
            between(users.createdAt, monthStart, monthEnd)
          )
        );

      // New hotels this month
      const newHotels = await db
        .select({ count: count() })
        .from(hotels)
        .where(between(hotels.createdAt, monthStart, monthEnd));

      // New rooms this month
      const newRooms = await db
        .select({ count: count() })
        .from(rooms)
        .where(between(rooms.createdAt, monthStart, monthEnd));

      // Bookings this month
      const monthBookings = await db
        .select({ 
          count: count(),
          revenue: sum(bookings.totalAmount)
        })
        .from(bookings)
        .where(between(bookings.createdAt, monthStart, monthEnd));

      last6MonthsData.push({
        month: months[monthStart.getMonth()],
        year: monthStart.getFullYear(),
        newUsers: Number(newUsers[0]?.count || 0),
        newHotels: Number(newHotels[0]?.count || 0),
        newRooms: Number(newRooms[0]?.count || 0),
        bookings: Number(monthBookings[0]?.count || 0),
        revenue: Number(monthBookings[0]?.revenue || 0),
      });
    }

    // Top performing cities with commission metrics
    const topCities = await db
      .select({
        cityName: hotels.city,
        hotelCount: count(hotels.id),
        paidRevenue: sum(sql`CASE WHEN ${bookings.status} = 'confirmed' AND ${bookings.paymentStatus} = 'completed' THEN ${bookings.totalAmount} ELSE 0 END`),
        pendingRevenue: sum(sql`CASE WHEN ${bookings.status} = 'confirmed' AND ${bookings.paymentStatus} = 'pending' THEN ${bookings.totalAmount} ELSE 0 END`),
        totalRevenue: sum(sql`CASE WHEN ${bookings.status} = 'confirmed' THEN ${bookings.totalAmount} ELSE 0 END`),
        totalBookings: count(bookings.id),
      })
      .from(hotels)
      .leftJoin(bookings, eq(hotels.id, bookings.hotelId))
      .where(
        eq(bookings.status, 'confirmed')
      )
      .groupBy(hotels.city)
      .orderBy(desc(sum(sql`CASE WHEN ${bookings.status} = 'confirmed' THEN ${bookings.totalAmount} ELSE 0 END`)))
      .limit(5);

    // Top performing hotels with commission metrics
    const topHotels = await db
      .select({
        hotelId: hotels.id,
        hotelName: hotels.name,
        city: hotels.city,
        paidRevenue: sum(sql`CASE WHEN ${bookings.status} = 'confirmed' AND ${bookings.paymentStatus} = 'completed' THEN ${bookings.totalAmount} ELSE 0 END`),
        pendingRevenue: sum(sql`CASE WHEN ${bookings.status} = 'confirmed' AND ${bookings.paymentStatus} = 'pending' THEN ${bookings.totalAmount} ELSE 0 END`),
        totalRevenue: sum(sql`CASE WHEN ${bookings.status} = 'confirmed' THEN ${bookings.totalAmount} ELSE 0 END`),
        totalBookings: count(bookings.id),
      })
      .from(hotels)
      .leftJoin(bookings, eq(hotels.id, bookings.hotelId))
      .where(
        eq(bookings.status, 'confirmed')
      )
      .groupBy(hotels.id, hotels.name, hotels.city)
      .orderBy(desc(sum(sql`CASE WHEN ${bookings.status} = 'confirmed' THEN ${bookings.totalAmount} ELSE 0 END`)))
      .limit(10);

    // Recent bookings
    const recentBookings = await db
      .select({
        id: bookings.id,
        checkInDate: bookings.checkInDate,
        checkOutDate: bookings.checkOutDate,
        totalAmount: bookings.totalAmount,
        status: bookings.status,
        paymentStatus: bookings.paymentStatus,
        hotelName: hotels.name,
        city: hotels.city,
        userName: users.name,
        userPhone: users.phone,
      })
      .from(bookings)
      .leftJoin(hotels, eq(bookings.hotelId, hotels.id))
      .leftJoin(users, eq(bookings.userId, users.id))
      .orderBy(desc(bookings.createdAt))
      .limit(10);

    return {
      overview: {
        totalCities: Number(totalCities[0]?.count || 0),
        totalHotels: Number(totalHotels[0]?.count || 0),
        totalUsers: Number(totalUsers[0]?.count || 0),
        totalBookings: Number(totalBookings[0]?.count || 0),
        totalPaidRevenue: Number(totalPaidRevenue[0]?.total || 0),
        needToPayRevenue: Number(needToPayRevenue[0]?.total || 0),
        totalRevenue: Number(totalPaidRevenue[0]?.total || 0) + Number(needToPayRevenue[0]?.total || 0),
        currentMonthRevenue: Number(currentMonthPaidRevenue[0]?.total || 0),
        lastMonthRevenue: Number(lastMonthPaidRevenue[0]?.total || 0),
        totalPaidCommission: totalPaidCommission,
        pendingCommission: pendingCommission,
        totalCommission: totalPaidCommission + pendingCommission,
        currentMonthCommission: currentMonthCommission,
        revenueGrowth: lastMonthPaidRevenue[0]?.total ? 
          ((Number(currentMonthPaidRevenue[0]?.total || 0) - Number(lastMonthPaidRevenue[0]?.total)) / Number(lastMonthPaidRevenue[0]?.total)) * 100 : 0,
      },
      bookingDistribution: {
        confirmed: Number(confirmedBookings[0]?.count || 0),
        cancelled: Number(cancelledBookings[0]?.count || 0),
        pending: Number(pendingBookings[0]?.count || 0),
        completed: Number(completedBookings[0]?.count || 0),
      },
      userDistribution: {
        customers: Number(totalCustomers[0]?.count || 0),
        admins: Number(totalAdmins[0]?.count || 0),
        hotelOwners: Number(totalHotelOwners[0]?.count || 0),
      },
      last6MonthsData: last6MonthsData,
      topCities: topCities.map(city => ({
        name: city.cityName,
        hotelCount: Number(city.hotelCount || 0),
        paidRevenue: Number(city.paidRevenue || 0),
        pendingRevenue: Number(city.pendingRevenue || 0),
        totalRevenue: Number(city.totalRevenue || 0),
        paidCommission: Number(city.paidRevenue || 0) * commissionRate,
        pendingCommission: Number(city.pendingRevenue || 0) * commissionRate,
        totalCommission: Number(city.totalRevenue || 0) * commissionRate,
        bookings: Number(city.totalBookings || 0),
      })),
      topHotels: topHotels.map(hotel => ({
        id: hotel.hotelId,
        name: hotel.hotelName,
        city: hotel.city,
        paidRevenue: Number(hotel.paidRevenue || 0),
        pendingRevenue: Number(hotel.pendingRevenue || 0),
        totalRevenue: Number(hotel.totalRevenue || 0),
        paidCommission: Number(hotel.paidRevenue || 0) * commissionRate,
        pendingCommission: Number(hotel.pendingRevenue || 0) * commissionRate,
        totalCommission: Number(hotel.totalRevenue || 0) * commissionRate,
        bookings: Number(hotel.totalBookings || 0),
      })),
      recentBookings: recentBookings.map(booking => ({
        id: booking.id,
        checkInDate: booking.checkInDate,
        checkOutDate: booking.checkOutDate,
        totalAmount: Number(booking.totalAmount || 0),
        status: booking.status,
        paymentStatus: booking.paymentStatus,
        hotel: {
          name: booking.hotelName,
          city: booking.city,
        },
        user: {
          name: booking.userName,
          phone: booking.userPhone,
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

    // Get hotel info
    const hotel = await db.query.hotels.findFirst({
      where: eq(hotels.id, hotelId),
    });

    if (!hotel) {
      throw new Error(`Hotel with id ${hotelId} not found`);
    }

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

    // Occupied rooms
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

    // Revenue metrics - Paid Revenue (confirmed + completed payments)
    const totalPaidRevenue = await db
      .select({ total: sum(bookings.totalAmount) })
      .from(bookings)
      .where(and(
        eq(bookings.hotelId, hotelId),
        eq(bookings.status, 'confirmed'),
        eq(bookings.paymentStatus, 'completed')
      ));

    // Need to Pay Revenue (confirmed + pending payments)
    const needToPayRevenue = await db
      .select({ total: sum(bookings.totalAmount) })
      .from(bookings)
      .where(and(
        eq(bookings.hotelId, hotelId),
        eq(bookings.status, 'confirmed'),
        eq(bookings.paymentStatus, 'pending')
      ));

    const currentMonthPaidRevenue = await db
      .select({ total: sum(bookings.totalAmount) })
      .from(bookings)
      .where(and(
        eq(bookings.hotelId, hotelId),
        eq(bookings.status, 'confirmed'),
        eq(bookings.paymentStatus, 'completed'),
        between(bookings.createdAt, startOfMonth, now)
      ));

    const lastMonthPaidRevenue = await db
      .select({ total: sum(bookings.totalAmount) })
      .from(bookings)
      .where(and(
        eq(bookings.hotelId, hotelId),
        eq(bookings.status, 'confirmed'),
        eq(bookings.paymentStatus, 'completed'),
        between(bookings.createdAt, startOfLastMonth, endOfLastMonth)
      ));

    // Booking metrics
    const totalBookings = await db
      .select({ count: count() })
      .from(bookings)
      .where(eq(bookings.hotelId, hotelId));

    const confirmedBookings = await db
      .select({ count: count() })
      .from(bookings)
      .where(and(
        eq(bookings.hotelId, hotelId),
        eq(bookings.status, 'confirmed')
      ));

    const cancelledBookings = await db
      .select({ count: count() })
      .from(bookings)
      .where(and(
        eq(bookings.hotelId, hotelId),
        eq(bookings.status, 'cancelled')
      ));

    const pendingBookings = await db
      .select({ count: count() })
      .from(bookings)
      .where(and(
        eq(bookings.hotelId, hotelId),
        eq(bookings.status, 'pending')
      ));

    // Get monthly time series data for the last 6 months
    const timeSeriesData = [];
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    for (let i = 5; i >= 0; i--) {
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
            between(bookings.createdAt, monthStart, monthEnd)
          )
        );

      // Calculate occupancy for this month (simplified calculation)
      const monthOccupancy = Math.floor(Math.random() * 20) + 70; // Mock data between 70-90%

      timeSeriesData.push({
        month: months[monthStart.getMonth()],
        year: monthStart.getFullYear(),
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
        totalRevenue: sum(bookings.totalAmount),
      })
      .from(rooms)
      .leftJoin(bookings, eq(rooms.id, bookings.roomId))
      .where(eq(rooms.hotelId, hotelId))
      .groupBy(rooms.name);

    // Top performing rooms
    const topRooms = await db
      .select({
        roomId: rooms.id,
        roomName: rooms.name,
        roomNumber: rooms.roomNumber,
        bookings: count(bookings.id),
        revenue: sum(bookings.totalAmount),
      })
      .from(rooms)
      .leftJoin(bookings, eq(rooms.id, bookings.roomId))
      .where(and(
        eq(rooms.hotelId, hotelId),
        eq(bookings.status, 'completed'),
        eq(bookings.paymentStatus, 'completed')
      ))
      .groupBy(rooms.id, rooms.name, rooms.roomNumber)
      .orderBy(desc(sum(bookings.totalAmount)))
      .limit(5);

    // Recent bookings for this hotel
    const recentBookings = await db
      .select({
        id: bookings.id,
        checkInDate: bookings.checkInDate,
        checkOutDate: bookings.checkOutDate,
        totalAmount: bookings.totalAmount,
        status: bookings.status,
        paymentStatus: bookings.paymentStatus,
        roomName: rooms.name,
        roomNumber: rooms.roomNumber,
        userName: users.name,
        userPhone: users.phone,
      })
      .from(bookings)
      .leftJoin(rooms, eq(bookings.roomId, rooms.id))
      .leftJoin(users, eq(bookings.userId, users.id))
      .where(eq(bookings.hotelId, hotelId))
      .orderBy(desc(bookings.createdAt))
      .limit(10);

    // Commission calculations
    const commissionRate = 0.10;
    const totalPaidCommission = Number(totalPaidRevenue[0]?.total || 0) * commissionRate;
    const pendingCommission = Number(needToPayRevenue[0]?.total || 0) * commissionRate;

    return {
      overview: {
        hotelName: hotel.name,
        city: hotel.city,
        totalRooms: Number(totalRooms[0]?.count || 0),
        availableRooms: Number(availableRooms[0]?.count || 0),
        occupiedRooms: Number(occupiedRooms[0]?.count || 0),
        occupancyRate: Number(occupancyRate),
        totalPaidRevenue: Number(totalPaidRevenue[0]?.total || 0),
        needToPayRevenue: Number(needToPayRevenue[0]?.total || 0),
        totalRevenue: Number(totalPaidRevenue[0]?.total || 0) + Number(needToPayRevenue[0]?.total || 0),
        currentMonthRevenue: Number(currentMonthPaidRevenue[0]?.total || 0),
        lastMonthRevenue: Number(lastMonthPaidRevenue[0]?.total || 0),
        totalPaidCommission: totalPaidCommission,
        pendingCommission: pendingCommission,
        totalCommission: totalPaidCommission + pendingCommission,
        totalBookings: Number(totalBookings[0]?.count || 0),
        revenueGrowth: lastMonthPaidRevenue[0]?.total ? 
          ((Number(currentMonthPaidRevenue[0]?.total || 0) - Number(lastMonthPaidRevenue[0]?.total)) / Number(lastMonthPaidRevenue[0]?.total)) * 100 : 0,
      },
      bookingDistribution: {
        confirmed: Number(confirmedBookings[0]?.count || 0),
        cancelled: Number(cancelledBookings[0]?.count || 0),
        pending: Number(pendingBookings[0]?.count || 0),
      },
      timeSeriesData: timeSeriesData,
      roomTypeDistribution: roomTypeDistribution.map(room => ({
        name: room.roomType,
        count: Number(room.count || 0),
        revenue: Number(room.totalRevenue || 0),
      })),
      topRooms: topRooms.map(room => ({
        id: room.roomId,
        name: room.roomName,
        roomNumber: room.roomNumber,
        bookings: Number(room.bookings || 0),
        revenue: Number(room.revenue || 0),
      })),
      recentBookings: recentBookings.map(booking => ({
        id: booking.id,
        checkInDate: booking.checkInDate,
        checkOutDate: booking.checkOutDate,
        totalAmount: Number(booking.totalAmount || 0),
        status: booking.status,
        paymentStatus: booking.paymentStatus,
        room: {
          name: booking.roomName,
          number: booking.roomNumber,
        },
        user: {
          name: booking.userName,
          phone: booking.userPhone,
        },
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

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // Get hotels in this city
    const cityHotels = await db.query.hotels.findMany({
      where: eq(hotels.city, city.name),
    });

    const hotelIds = cityHotels.map(h => h.id);

    if (hotelIds.length === 0) {
      return {
        overview: {
          cityName: city.name,
          totalHotels: 0,
          totalRooms: 0,
          totalBookings: 0,
          totalRevenue: 0,
          currentMonthRevenue: 0,
          lastMonthRevenue: 0,
          revenueGrowth: 0,
        },
        bookingDistribution: {
          confirmed: 0,
          cancelled: 0,
          pending: 0,
          completed: 0,
        },
        timeSeriesData: [],
        hotelDistribution: [],
        topHotels: [],
        recentBookings: [],
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

    // Paid Revenue (confirmed + completed payments)
    const totalPaidRevenue = await db
      .select({ total: sum(bookings.totalAmount) })
      .from(bookings)
      .where(and(
        inArray(bookings.hotelId, hotelIds),
        eq(bookings.status, 'confirmed'),
        eq(bookings.paymentStatus, 'completed')
      ));

    // Need to Pay Revenue (confirmed + pending payments)
    const needToPayRevenue = await db
      .select({ total: sum(bookings.totalAmount) })
      .from(bookings)
      .where(and(
        inArray(bookings.hotelId, hotelIds),
        eq(bookings.status, 'confirmed'),
        eq(bookings.paymentStatus, 'pending')
      ));

    const currentMonthPaidRevenue = await db
      .select({ total: sum(bookings.totalAmount) })
      .from(bookings)
      .where(and(
        inArray(bookings.hotelId, hotelIds),
        eq(bookings.status, 'confirmed'),
        eq(bookings.paymentStatus, 'completed'),
        between(bookings.createdAt, startOfMonth, now)
      ));

    const lastMonthPaidRevenue = await db
      .select({ total: sum(bookings.totalAmount) })
      .from(bookings)
      .where(and(
        inArray(bookings.hotelId, hotelIds),
        eq(bookings.status, 'confirmed'),
        eq(bookings.paymentStatus, 'completed'),
        between(bookings.createdAt, startOfLastMonth, endOfLastMonth)
      ));

    // Booking distribution
    const confirmedBookings = await db
      .select({ count: count() })
      .from(bookings)
      .where(and(
        inArray(bookings.hotelId, hotelIds),
        eq(bookings.status, 'confirmed')
      ));

    const cancelledBookings = await db
      .select({ count: count() })
      .from(bookings)
      .where(and(
        inArray(bookings.hotelId, hotelIds),
        eq(bookings.status, 'cancelled')
      ));

    const pendingBookings = await db
      .select({ count: count() })
      .from(bookings)
      .where(and(
        inArray(bookings.hotelId, hotelIds),
        eq(bookings.status, 'pending')
      ));

    const completedBookings = await db
      .select({ count: count() })
      .from(bookings)
      .where(and(
        inArray(bookings.hotelId, hotelIds),
        eq(bookings.status, 'completed')
      ));

    // Get monthly time series data
    const timeSeriesData = [];
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    for (let i = 5; i >= 0; i--) {
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
            between(bookings.createdAt, monthStart, monthEnd)
          )
        );

      timeSeriesData.push({
        month: months[monthStart.getMonth()],
        year: monthStart.getFullYear(),
        bookings: Number(monthData[0]?.bookings || 0),
        revenue: Number(monthData[0]?.revenue || 0),
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

    // Top hotels in this city with commission metrics
    const topHotels = await db
      .select({
        hotelId: hotels.id,
        hotelName: hotels.name,
        paidRevenue: sum(sql`CASE WHEN ${bookings.status} = 'confirmed' AND ${bookings.paymentStatus} = 'completed' THEN ${bookings.totalAmount} ELSE 0 END`),
        pendingRevenue: sum(sql`CASE WHEN ${bookings.status} = 'confirmed' AND ${bookings.paymentStatus} = 'pending' THEN ${bookings.totalAmount} ELSE 0 END`),
        totalRevenue: sum(sql`CASE WHEN ${bookings.status} = 'confirmed' THEN ${bookings.totalAmount} ELSE 0 END`),
        totalBookings: count(bookings.id),
      })
      .from(hotels)
      .leftJoin(bookings, eq(hotels.id, bookings.hotelId))
      .where(and(
        inArray(hotels.id, hotelIds),
        eq(bookings.status, 'confirmed')
      ))
      .groupBy(hotels.id, hotels.name)
      .orderBy(desc(sum(sql`CASE WHEN ${bookings.status} = 'confirmed' THEN ${bookings.totalAmount} ELSE 0 END`)))
      .limit(5);

    // Recent bookings in this city
    const recentBookings = await db
      .select({
        id: bookings.id,
        checkInDate: bookings.checkInDate,
        checkOutDate: bookings.checkOutDate,
        totalAmount: bookings.totalAmount,
        status: bookings.status,
        paymentStatus: bookings.paymentStatus,
        hotelName: hotels.name,
        userName: users.name,
        userPhone: users.phone,
      })
      .from(bookings)
      .leftJoin(hotels, eq(bookings.hotelId, hotels.id))
      .leftJoin(users, eq(bookings.userId, users.id))
      .where(inArray(bookings.hotelId, hotelIds))
      .orderBy(desc(bookings.createdAt))
      .limit(10);

    // Commission calculations
    const commissionRate = 0.10;
    const totalPaidCommission = Number(totalPaidRevenue[0]?.total || 0) * commissionRate;
    const pendingCommission = Number(needToPayRevenue[0]?.total || 0) * commissionRate;

    return {
      overview: {
        cityName: city.name,
        totalHotels: cityHotels.length,
        totalRooms: Number(totalRooms[0]?.count || 0),
        totalBookings: Number(totalBookings[0]?.count || 0),
        totalPaidRevenue: Number(totalPaidRevenue[0]?.total || 0),
        needToPayRevenue: Number(needToPayRevenue[0]?.total || 0),
        totalRevenue: Number(totalPaidRevenue[0]?.total || 0) + Number(needToPayRevenue[0]?.total || 0),
        currentMonthRevenue: Number(currentMonthPaidRevenue[0]?.total || 0),
        lastMonthRevenue: Number(lastMonthPaidRevenue[0]?.total || 0),
        totalPaidCommission: totalPaidCommission,
        pendingCommission: pendingCommission,
        totalCommission: totalPaidCommission + pendingCommission,
        revenueGrowth: lastMonthPaidRevenue[0]?.total ? 
          ((Number(currentMonthPaidRevenue[0]?.total || 0) - Number(lastMonthPaidRevenue[0]?.total)) / Number(lastMonthPaidRevenue[0]?.total)) * 100 : 0,
      },
      bookingDistribution: {
        confirmed: Number(confirmedBookings[0]?.count || 0),
        cancelled: Number(cancelledBookings[0]?.count || 0),
        pending: Number(pendingBookings[0]?.count || 0),
        completed: Number(completedBookings[0]?.count || 0),
      },
      timeSeriesData: timeSeriesData,
      hotelDistribution: hotelDistribution.map(hotel => ({
        name: `${hotel.starRating}‑Star`,
        value: Number(hotel.count || 0),
      })),
      topHotels: topHotels.map(hotel => ({
        id: hotel.hotelId,
        name: hotel.hotelName,
        paidRevenue: Number(hotel.paidRevenue || 0),
        pendingRevenue: Number(hotel.pendingRevenue || 0),
        totalRevenue: Number(hotel.totalRevenue || 0),
        paidCommission: Number(hotel.paidRevenue || 0) * commissionRate,
        pendingCommission: Number(hotel.pendingRevenue || 0) * commissionRate,
        totalCommission: Number(hotel.totalRevenue || 0) * commissionRate,
        bookings: Number(hotel.totalBookings || 0),
      })),
      recentBookings: recentBookings.map(booking => ({
        id: booking.id,
        checkInDate: booking.checkInDate,
        checkOutDate: booking.checkOutDate,
        totalAmount: Number(booking.totalAmount || 0),
        status: booking.status,
        paymentStatus: booking.paymentStatus,
        hotel: {
          name: booking.hotelName,
        },
        user: {
          name: booking.userName,
          phone: booking.userPhone,
        },
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
        revenue: Number(item.revenue || 0),
        bookings: Number(item.bookings || 0),
      })),
    };
  }
}
