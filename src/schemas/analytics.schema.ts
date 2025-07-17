import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

// Base schemas
export const MonthlyDataSchema = z.object({
  date: z.string(),
  sales: z.number().int().min(0),
  revenue: z.number().min(0),
  profit: z.number().min(0),
});

export const DashboardOverviewSchema = z.object({
  totalHotels: z.number().int().min(0),
  totalUsers: z.number().int().min(0),
  totalBookings: z.number().int().min(0),
  monthlyRevenue: z.number().min(0),
  monthlyData: z.array(MonthlyDataSchema),
});

export const BookingsAnalyticsSchema = z.object({
  confirmedBookings: z.number().int().min(0),
  pendingBookings: z.number().int().min(0),
  cancelledBookings: z.number().int().min(0),
  monthlyData: z.array(MonthlyDataSchema),
});

export const RevenueAnalyticsSchema = z.object({
  totalRevenue: z.number().min(0),
  pendingRevenue: z.number().min(0),
  refundedAmount: z.number().min(0),
});

export const TimeSeriesDataSchema = z.object({
  month: z.string(),
  bookings: z.number().int().min(0),
  revenue: z.number().min(0),
});

export const HotelTimeSeriesDataSchema = z.object({
  month: z.string(),
  bookings: z.number().int().min(0),
  revenue: z.number().min(0),
  occupancy: z.number().min(0).max(100),
});

export const HotelOverviewSchema = z.object({
  totalRooms: z.number().int().min(0),
  occupancyRate: z.number().min(0).max(100),
  monthlyRevenue: z.number().min(0),
});

export const DistributionSchema = z.object({
  name: z.string(),
  value: z.number().int().min(0),
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
    bookings: BookingsAnalyticsSchema,
    revenue: RevenueAnalyticsSchema,
  }),
});

export const HotelDashboardResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    overview: HotelOverviewSchema,
    timeSeriesData: z.array(HotelTimeSeriesDataSchema),
    roomTypeDistribution: z.array(DistributionSchema),
  }),
});

export const CityAnalyticsResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    overview: z.object({
      totalHotels: z.number().int().min(0),
      totalRooms: z.number().int().min(0),
      totalBookings: z.number().int().min(0),
      totalRevenue: z.number().min(0),
    }),
    timeSeriesData: z.array(TimeSeriesDataSchema),
    hotelDistribution: z.array(DistributionSchema),
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
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object' }
      }
    },
    400: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        errors: { type: 'array' }
      }
    },
    500: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' }
      }
    }
  },
  tags: ['analytics'],
  summary: 'Get dashboard analytics',
  description: 'Get dashboard analytics for super admin or hotel admin',
};

export const getCityAnalyticsSchema = {
  params: zodToJsonSchema(CityAnalyticsParamsSchema),
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object' }
      }
    },
    404: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' }
      }
    },
    500: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' }
      }
    }
  },
  tags: ['analytics'],
  summary: 'Get city analytics',
  description: 'Get analytics data for a specific city',
};

export const getRevenueAnalyticsSchema = {
  querystring: zodToJsonSchema(RevenueAnalyticsQuerySchema),
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object' }
      }
    },
    400: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' }
      }
    },
    500: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' }
      }
    }
  },
  tags: ['analytics'],
  summary: 'Get revenue analytics',
  description: 'Get revenue analytics with time series data',
};