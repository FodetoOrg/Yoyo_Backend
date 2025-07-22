
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

// Base schemas
export const TimeSeriesDataSchema = z.object({
  month: z.string(),
  year: z.number(),
  bookings: z.number().int().min(0),
  revenue: z.number().min(0),
});

export const HotelTimeSeriesDataSchema = z.object({
  month: z.string(),
  year: z.number(),
  bookings: z.number().int().min(0),
  revenue: z.number().min(0),
  occupancy: z.number().min(0).max(100),
});

export const Last6MonthsDataSchema = z.object({
  month: z.string(),
  year: z.number(),
  newUsers: z.number().int().min(0),
  newHotels: z.number().int().min(0),
  newRooms: z.number().int().min(0),
  bookings: z.number().int().min(0),
  revenue: z.number().min(0),
});

export const SuperAdminOverviewSchema = z.object({
  totalCities: z.number().int().min(0),
  totalHotels: z.number().int().min(0),
  totalUsers: z.number().int().min(0),
  totalBookings: z.number().int().min(0),
  totalPaidRevenue: z.number().min(0),
  needToPayRevenue: z.number().min(0),
  totalRevenue: z.number().min(0),
  currentMonthRevenue: z.number().min(0),
  lastMonthRevenue: z.number().min(0),
  totalPaidCommission: z.number().min(0),
  pendingCommission: z.number().min(0),
  totalCommission: z.number().min(0),
  currentMonthCommission: z.number().min(0),
  revenueGrowth: z.number(),
});

export const HotelOverviewSchema = z.object({
  hotelName: z.string(),
  city: z.string(),
  totalRooms: z.number().int().min(0),
  availableRooms: z.number().int().min(0),
  occupiedRooms: z.number().int().min(0),
  occupancyRate: z.number().min(0).max(100),
  totalPaidRevenue: z.number().min(0),
  needToPayRevenue: z.number().min(0),
  totalRevenue: z.number().min(0),
  currentMonthRevenue: z.number().min(0),
  lastMonthRevenue: z.number().min(0),
  totalPaidCommission: z.number().min(0),
  pendingCommission: z.number().min(0),
  totalCommission: z.number().min(0),
  totalBookings: z.number().int().min(0),
  revenueGrowth: z.number(),
});

export const CityOverviewSchema = z.object({
  cityName: z.string(),
  totalHotels: z.number().int().min(0),
  totalRooms: z.number().int().min(0),
  totalBookings: z.number().int().min(0),
  totalPaidRevenue: z.number().min(0),
  needToPayRevenue: z.number().min(0),
  totalRevenue: z.number().min(0),
  currentMonthRevenue: z.number().min(0),
  lastMonthRevenue: z.number().min(0),
  totalPaidCommission: z.number().min(0),
  pendingCommission: z.number().min(0),
  totalCommission: z.number().min(0),
  revenueGrowth: z.number(),
});

export const BookingDistributionSchema = z.object({
  confirmed: z.number().int().min(0),
  cancelled: z.number().int().min(0),
  pending: z.number().int().min(0),
  completed: z.number().int().min(0).optional(),
});

export const UserDistributionSchema = z.object({
  customers: z.number().int().min(0),
  admins: z.number().int().min(0),
  hotelOwners: z.number().int().min(0),
});

export const DistributionSchema = z.object({
  name: z.string(),
  value: z.number().int().min(0),
  count: z.number().int().min(0).optional(),
  revenue: z.number().min(0).optional(),
});

export const TopCitySchema = z.object({
  name: z.string(),
  hotelCount: z.number().int().min(0),
  paidRevenue: z.number().min(0),
  pendingRevenue: z.number().min(0),
  totalRevenue: z.number().min(0),
  paidCommission: z.number().min(0),
  pendingCommission: z.number().min(0),
  totalCommission: z.number().min(0),
  bookings: z.number().int().min(0),
});

export const TopHotelSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  city: z.string().optional(),
  paidRevenue: z.number().min(0),
  pendingRevenue: z.number().min(0),
  totalRevenue: z.number().min(0),
  paidCommission: z.number().min(0),
  pendingCommission: z.number().min(0),
  totalCommission: z.number().min(0),
  bookings: z.number().int().min(0),
});

export const TopRoomSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  roomNumber: z.string(),
  bookings: z.number().int().min(0),
  revenue: z.number().min(0),
});

export const RecentBookingSchema = z.object({
  id: z.string().uuid(),
  checkInDate: z.string().datetime(),
  checkOutDate: z.string().datetime(),
  totalAmount: z.number(),
  status: z.string(),
  paymentStatus: z.string(),
  hotel: z.object({
    name: z.string(),
    city: z.string().optional(),
  }),
  room: z.object({
    name: z.string(),
    number: z.string(),
  }).optional(),
  user: z.object({
    name: z.string().nullable(),
    phone: z.string().nullable(),
  }),
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
    overview: SuperAdminOverviewSchema,
    bookingDistribution: BookingDistributionSchema,
    userDistribution: UserDistributionSchema,
    last6MonthsData: z.array(Last6MonthsDataSchema),
    topCities: z.array(TopCitySchema),
    topHotels: z.array(TopHotelSchema),
    recentBookings: z.array(RecentBookingSchema),
  }),
});

export const HotelDashboardResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    overview: HotelOverviewSchema,
    bookingDistribution: BookingDistributionSchema,
    timeSeriesData: z.array(HotelTimeSeriesDataSchema),
    roomTypeDistribution: z.array(DistributionSchema),
    topRooms: z.array(TopRoomSchema),
    recentBookings: z.array(RecentBookingSchema),
  }),
});

export const CityAnalyticsResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    overview: CityOverviewSchema,
    bookingDistribution: BookingDistributionSchema,
    timeSeriesData: z.array(TimeSeriesDataSchema),
    hotelDistribution: z.array(DistributionSchema),
    topHotels: z.array(TopHotelSchema),
    recentBookings: z.array(RecentBookingSchema),
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
  description: 'Get comprehensive dashboard analytics for super admin or hotel admin',
};

export const getCityAnalyticsSchema = {
  params: zodToJsonSchema(CityAnalyticsParamsSchema),
  response: {
    
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
  description: 'Get comprehensive analytics data for a specific city',
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
  description: 'Get comprehensive revenue analytics with time series data',
};
