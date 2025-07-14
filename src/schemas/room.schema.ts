import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

// Base schemas
export const RoomImageSchema = z.object({
  id: z.string().uuid(),
  url: z.string().url(),
  isPrimary: z.boolean(),
});

export const RoomTypeSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
});

export const HotelBasicSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  city: z.string(),
  address: z.string(),
});

export const RoomSchema = z.object({
  id: z.string().uuid(),
  hotelId: z.string().uuid(),
  roomNumber: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  capacity: z.number().int(),
  maxGuests: z.number().int(),
  bedType: z.string().nullable(),
  size: z.number().nullable(),
  floor: z.number().int().nullable(),
  pricePerNight: z.number(),
  pricePerHour: z.number().nullable(),
  type: z.string().nullable(),
  roomTypeId: z.string().uuid().nullable(),
  roomType: RoomTypeSchema.nullable(),
  isHourlyBooking: z.boolean(),
  isDailyBooking: z.boolean(),
  amenities: z.array(z.string()),
  status: z.enum(['available', 'occupied', 'maintenance', 'out_of_order']),
  hotel: HotelBasicSchema,
  images: z.array(RoomImageSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// Request schemas
export const RoomFiltersSchema = z.object({
  hotelId: z.string().uuid().optional(),
  status: z.enum(['available', 'occupied', 'maintenance', 'out_of_order']).optional(),
  roomType: z.string().optional(),
  city: z.string().optional(),
  minPrice: z.number().positive().optional(),
  maxPrice: z.number().positive().optional(),
  capacity: z.number().int().positive().optional(),
  isHourlyBooking: z.boolean().optional(),
  isDailyBooking: z.boolean().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(10),
  search: z.string().optional(),
});

export const CreateRoomRequestSchema = z.object({
  hotelId: z.string().uuid(),
  roomNumber: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  capacity: z.number().int().min(1),
  bedType: z.string().optional(),
  size: z.number().positive().optional(),
  floor: z.number().int().optional(),
  pricePerNight: z.number().positive(),
  pricePerHour: z.number().positive().optional(),
  type: z.string().optional(),
  roomTypeId: z.string().uuid().optional(),
  isHourlyBooking: z.union([z.boolean(), z.string()]).optional(),
  isDailyBooking: z.union([z.boolean(), z.string()]).optional(),
  amenities: z.array(z.string()).optional(),
  status: z.enum(['available', 'occupied', 'maintenance', 'out_of_order']).default('available'),
  images: z.array(z.string()).optional(),
});

export const UpdateRoomRequestSchema = CreateRoomRequestSchema.partial().omit({ hotelId: true });

export const RoomParamsSchema = z.object({
  id: z.string().uuid(),
});

export const RoomStatisticsSchema = z.object({
  totalRooms: z.number().int().min(0),
  availableRooms: z.number().int().min(0),
  occupiedRooms: z.number().int().min(0),
  maintenanceRooms: z.number().int().min(0),
  outOfOrderRooms: z.number().int().min(0),
  hourlyBookingRooms: z.number().int().min(0),
  dailyBookingRooms: z.number().int().min(0),
  occupancyRate: z.number().min(0).max(100),
  cityStats: z.record(z.string(), z.number()).nullable(),
});

// Response schemas
export const RoomResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    room: RoomSchema,
  }),
});

export const RoomListResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    rooms: z.array(RoomSchema),
    total: z.number().int().min(0),
    page: z.number().int().min(1),
    limit: z.number().int().min(1),
    totalPages: z.number().int().min(1),
  }),
});

export const RoomStatisticsResponseSchema = z.object({
  success: z.boolean(),
  data: RoomStatisticsSchema,
});

export const DeleteRoomResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

// Fastify schema objects
export const getRoomsSchema = {
  querystring: zodToJsonSchema(RoomFiltersSchema),
  response: {
    200: zodToJsonSchema(RoomListResponseSchema),
  },
  tags: ['rooms'],
  summary: 'Get rooms with advanced filtering',
  description: 'Retrieve rooms with optional filtering by hotel, status, city, price range, etc.',
};

export const getRoomByIdSchema = {
  params: zodToJsonSchema(RoomParamsSchema),
  response: {
    200: zodToJsonSchema(RoomResponseSchema),
    404: zodToJsonSchema(z.object({
      success: z.boolean(),
      message: z.string(),
    })),
  },
  tags: ['rooms'],
  summary: 'Get room by ID',
  description: 'Retrieve a specific room by its ID',
};

export const createRoomSchema = {
  body: zodToJsonSchema(CreateRoomRequestSchema),
  response: {
    201: zodToJsonSchema(RoomResponseSchema),
    400: zodToJsonSchema(z.object({
      success: z.boolean(),
      message: z.string(),
      errors: z.array(z.any()).optional(),
    })),
  },
  tags: ['rooms'],
  summary: 'Create a new room',
  description: 'Create a new room with images and amenities',
};

export const updateRoomSchema = {
  params: zodToJsonSchema(RoomParamsSchema),
  body: zodToJsonSchema(UpdateRoomRequestSchema),
  response: {
    200: zodToJsonSchema(RoomResponseSchema),
    400: zodToJsonSchema(z.object({
      success: z.boolean(),
      message: z.string(),
      errors: z.array(z.any()).optional(),
    })),
  },
  tags: ['rooms'],
  summary: 'Update room',
  description: 'Update an existing room',
};

export const deleteRoomSchema = {
  params: zodToJsonSchema(RoomParamsSchema),
  response: {
    200: zodToJsonSchema(DeleteRoomResponseSchema),
    404: zodToJsonSchema(z.object({
      success: z.boolean(),
      message: z.string(),
    })),
  },
  tags: ['rooms'],
  summary: 'Delete room',
  description: 'Delete an existing room',
};

export const getRoomStatisticsSchema = {
  querystring: zodToJsonSchema(z.object({
    hotelId: z.string().uuid().optional(),
  })),
  response: {
    200: zodToJsonSchema(RoomStatisticsResponseSchema),
  },
  tags: ['rooms'],
  summary: 'Get room statistics',
  description: 'Get room statistics and analytics',
};