import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

// Base schemas
export const DashboardOverviewSchema = z.object({
  totalHotels: z.number().int().min(0),
  totalUsers: z.number().int().min(0),
  totalBookings: z.number().int().min(0),
  totalRooms: z.number().int().min(0),
  monthlyRevenue: z.number().min(0),
  lastMonthRevenue: z.number().min(0),
  monthlyBookings: z.number().int().min(0),
  lastMonthBookings: z.number().int().min(0),
});

export const HotelOverviewSchema = z.object({
  totalRooms: z.number().int().min(0),
  availableRooms: z.number().int().min(0),
  occupiedRooms: z.number().int().min(0),
  occupancyRate: z.number().min(0).max(100),
  monthlyBookings: z.number().int().min(0),
  lastMonthBookings: z.number().int().min(0),
  monthlyRevenue: z.number().min(0),
  lastMonthRevenue: z.number().min(0),
});

export const TopHotelSchema = z.object({
  hotelId: z.string().uuid(),
  name: z.string(),
  revenue: z.number().min(0),
  bookings: z.number().int().min(0),
});

export const CityAnalyticsSchema = z.object({
  city: z.string(),
  hotels: z.number().int().min(0),
  bookings: z.number().int().min(0),
  revenue: z.number().min(0),
});

export const RecentBookingSchema = z.object({
  id: z.string().uuid(),
  checkInDate: z.string().datetime(),
  checkOutDate: z.string().datetime(),
  totalAmount: z.number(),
  status: z.string(),
  hotel: z.object({
    name: z.string(),
    city: z.string(),
  }),
  user: z.object({
    name: z.string().nullable(),
    phone: z.string().nullable(),
  }),
});

export const RoomPerformanceSchema = z.object({
  roomId: z.string().uuid(),
  name: z.string(),
  roomNumber: z.string(),
  bookings: z.number().int().min(0),
  revenue: z.number().min(0),
});

// Request schemas
export const DashboardQuerySchema = z.object({
  type: z.enum(['super', 'hotel']),
  hotelId: z.string().uuid().optional(),
});

export const CityAnalyticsParamsSchema = z.object({
  id: z.string().uuid(),
});

export const RevenueAnalyticsQuerySchema = z.object({
  hotelId: z.string().uuid().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  period: z.enum(['daily', 'weekly', 'monthly', 'yearly']).default('monthly'),
});

// Response schemas
export const SuperAdminDashboardResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    overview: DashboardOverviewSchema,
    topHotels: z.array(TopHotelSchema),
    cityAnalytics: z.array(CityAnalyticsSchema),
    recentBookings: z.array(RecentBookingSchema),
  }),
});

export const HotelDashboardResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    hotel: z.object({
      id: z.string().uuid(),
      name: z.string(),
      city: z.string(),
      address: z.string(),
    }),
    overview: HotelOverviewSchema,
    recentBookings: z.array(RecentBookingSchema),
    roomPerformance: z.array(RoomPerformanceSchema),
  }),
});

export const CityAnalyticsResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    city: z.object({
      id: z.string().uuid(),
      name: z.string(),
      state: z.string(),
    }),
    overview: z.object({
      totalHotels: z.number().int().min(0),
      totalRooms: z.number().int().min(0),
      totalBookings: z.number().int().min(0),
      totalRevenue: z.number().min(0),
    }),
    hotels: z.array(z.object({
      hotelId: z.string().uuid(),
      name: z.string(),
      bookings: z.number().int().min(0),
      revenue: z.number().min(0),
    })),
  }),
});

export const RevenueAnalyticsResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    period: z.string(),
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
    timeSeriesData: z.array(z.object({
      period: z.string(),
      revenue: z.number().min(0),
      bookings: z.number().int().min(0),
    })),
  }),
});

// Fastify schema objects
export const getDashboardAnalyticsSchema = {
  querystring: zodToJsonSchema(DashboardQuerySchema),
  response: {
    200: zodToJsonSchema(z.union([
      SuperAdminDashboardResponseSchema,
      HotelDashboardResponseSchema,
    ])),
  },
  tags: ['analytics'],
  summary: 'Get dashboard analytics',
  description: 'Get dashboard analytics for super admin or hotel admin',
};

export const getCityAnalyticsSchema = {
  params: zodToJsonSchema(CityAnalyticsParamsSchema),
  response: {
    200: zodToJsonSchema(CityAnalyticsResponseSchema),
    404: zodToJsonSchema(z.object({
      success: z.boolean(),
      message: z.string(),
    })),
  },
  tags: ['analytics'],
  summary: 'Get city analytics',
  description: 'Get analytics data for a specific city',
};

export const getRevenueAnalyticsSchema = {
  querystring: zodToJsonSchema(RevenueAnalyticsQuerySchema),
  response: {
    200: zodToJsonSchema(RevenueAnalyticsResponseSchema),
  },
  tags: ['analytics'],
  summary: 'Get revenue analytics',
  description: 'Get revenue analytics with time series data',
};