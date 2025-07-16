import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

// Base schemas
export const HotelImageSchema = z.object({
  id: z.string().uuid(),
  url: z.string().url(),
  isPrimary: z.boolean(),
});

export const HotelSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  address: z.string(),
  city: z.string(),
  zipCode: z.string().nullable(),
  starRating: z.string().nullable(),
  amenities: z.array(z.string()),
  mapCoordinates: z.string(),
  ownerId: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  images: z.array(HotelImageSchema),
});

export const RoomSchema = z.object({
  id: z.string().uuid(),
  hotelId: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  maxGuests: z.number().int(),
  pricePerNight: z.number(),
  pricePerHour: z.number().nullable(),
  roomType: z.string(),
  amenities: z.array(z.string()),
  available: z.boolean(),
  images: z.array(HotelImageSchema),
});

// Search schema
export const HotelSearchQuerySchema = z.object({
  city: z.string().min(1),
  checkIn: z.string().datetime().optional(),
  checkOut: z.string().datetime().optional(),
  guests: z.number().int().min(1).default(1),
  rooms: z.number().int().min(1).default(1),
  bookingType: z.enum(["daily", "hourly"]).default("daily"),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(10),
});

export const HotelSearchResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    hotels: z.array(HotelSchema),
    total: z.number().int().min(0),
    page: z.number().int().min(1),
    limit: z.number().int().min(1),
  }),
});

// Get hotel by ID schema
export const GetHotelParamsSchema = z.object({
  id: z.string(),
});

export const GetHotelResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    hotel: HotelSchema.extend({
      cityId: z.string(),
    }),
  }),
});

export const GetHotelErrorSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

// Create hotel schema
export const CreateHotelBodySchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  address: z.string(),
  cityId: z.string(),
  ownerId: z.string(),
  zipCode: z.string(),
  starRating: z.string().optional(),
  amenities: z.array(z.string()).optional(),
  images: z.array(z.string()).optional(),
  mapCoordinates: z.string(),
  paymentMode: z.enum(['online', 'offline', 'both']).default('offline'),
  onlinePaymentEnabled: z.boolean().default(false),
  offlinePaymentEnabled: z.boolean().default(true),
});

export const CreateHotelResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    hotel: HotelSchema,
  }),
});

// Update hotel schema
export const UpdateHotelBodySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  zipCode: z.string().optional(),
  starRating: z.string(),
  amenities: z.array(z.string()).optional(),
  paymentMode: z.enum(['online', 'offline', 'both']).optional(),
  onlinePaymentEnabled: z.boolean().optional(),
  offlinePaymentEnabled: z.boolean().optional(),
});

export const UpdateHotelResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    hotel: HotelSchema,
  }),
});

// Create room schema
export const CreateRoomBodySchema = z.object({
  roomNumber: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  capacity: z.number().int().min(1),
  bedType: z.string().optional(),
  size: z.number().optional(),
  floor: z.number().int().optional(),
  pricePerNight: z.number().min(0),
  pricePerHour: z.number().min(0).optional(),
  type: z.string().optional(),
  roomTypeId: z.string().uuid().optional(),
  isHourlyBooking: z.union([z.boolean(), z.string()]).optional(),
  isDailyBooking: z.union([z.boolean(), z.string()]).optional(),
  amenities: z.array(z.string()).optional(),
  status: z.string().default('available'),
  images: z.array(z.string()).optional(),
});

export const CreateRoomResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    room: RoomSchema,
  }),
});

// Export Fastify schema objects
export const hotelSearchSchema = {
  querystring: zodToJsonSchema(HotelSearchQuerySchema),
  response: {
    200: zodToJsonSchema(HotelSearchResponseSchema),
  },
};

export const getHotelSchema = {
  params: zodToJsonSchema(GetHotelParamsSchema),
  response: {
    200: zodToJsonSchema(GetHotelResponseSchema),
    404: zodToJsonSchema(GetHotelErrorSchema),
  },
};

export const createHotelSchema = {
  body: zodToJsonSchema(CreateHotelBodySchema),
  response: {
    201: zodToJsonSchema(CreateHotelResponseSchema),
  },
};

export const updateHotelSchema = {
  params: zodToJsonSchema(GetHotelParamsSchema),
  body: zodToJsonSchema(
    CreateHotelBodySchema.extend({
      id: z.string(),
    })
  ),
  response: {
    200: zodToJsonSchema(UpdateHotelResponseSchema),
  },
};

export const createRoomSchema = {
  params: zodToJsonSchema(GetHotelParamsSchema),
  body: zodToJsonSchema(CreateRoomBodySchema),
  response: {
    201: zodToJsonSchema(CreateRoomResponseSchema),
  },
};

export const getHotelsSchema = {
  response: {
    200: zodToJsonSchema(z.array(HotelSchema)),
    404: zodToJsonSchema(GetHotelErrorSchema),
  },
};

export const getHotelDetailsQuerySchema = z.object({
  guests: z.number().int().min(1).optional(),
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
});

export const getHotelDetailsSchema = {
  params: zodToJsonSchema(GetHotelParamsSchema),
  querystring: zodToJsonSchema(getHotelDetailsQuerySchema),
  response: {
    200: zodToJsonSchema(GetHotelResponseSchema),
    404: zodToJsonSchema(GetHotelErrorSchema),
  },
};

const getHotelUsersSchema = {
  params: zodToJsonSchema(
    z.object({
      hotelId: z.string().default(""),
    }),
    { name: "ParamsSchema" }
  ),
  response: {
    200: zodToJsonSchema(
      z.array(
        z.object({
          id: z.string().uuid(),
          phone: z.string(),
        })
      ),
      { name: "HotelUserResponse" }
    ),
  },
};


