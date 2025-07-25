
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

// Base schemas
export const RoomHourlyStaySchema = z.object({
  id: z.string().uuid(),
  roomId: z.string().uuid(),
  hours: z.number().int().min(1).max(24),
  price: z.number().min(0),
  name: z.string(),
  description: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const RoomHourlyStayWithRoomSchema = z.object({
  hourlyStay: RoomHourlyStaySchema,
  room: z.object({
    id: z.string().uuid(),
    name: z.string(),
    roomNumber: z.string(),
  }),
});

// Request schemas
export const CreateHourlyStayRequestSchema = z.object({
  roomId: z.string().uuid(),
  hours: z.number().int().min(1).max(24),
  price: z.number().min(0),
  name: z.string().min(1),
  description: z.string().optional(),
});

export const UpdateHourlyStayRequestSchema = z.object({
  hours: z.number().int().min(1).max(24).optional(),
  price: z.number().min(0).optional(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const GetHourlyStaysByRoomParamsSchema = z.object({
  roomId: z.string().uuid(),
});

export const GetHourlyStaysByHotelParamsSchema = z.object({
  hotelId: z.string().uuid(),
});

export const HourlyStayParamsSchema = z.object({
  id: z.string().uuid(),
});

// Response schemas
export const CreateHourlyStayResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: RoomHourlyStaySchema,
});

export const GetHourlyStaysResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(RoomHourlyStaySchema),
});

export const GetHourlyStaysByHotelResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(RoomHourlyStayWithRoomSchema),
});

export const UpdateHourlyStayResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: RoomHourlyStaySchema,
});

export const DeleteHourlyStayResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export const ErrorResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  errors: z.array(z.any()).optional(),
});

// Fastify schema objects
export const createHourlyStaySchema = {
  body: zodToJsonSchema(CreateHourlyStayRequestSchema),
  response: {
    201: zodToJsonSchema(CreateHourlyStayResponseSchema),
    400: zodToJsonSchema(ErrorResponseSchema),
    500: zodToJsonSchema(ErrorResponseSchema),
  },
  tags: ['room-hourly-stays'],
  summary: 'Create a new hourly stay package',
  description: 'Create a new hourly stay package for a room',
};

export const getHourlyStaysByRoomSchema = {
  params: zodToJsonSchema(GetHourlyStaysByRoomParamsSchema),
  response: {
    200: zodToJsonSchema(GetHourlyStaysResponseSchema),
    500: zodToJsonSchema(ErrorResponseSchema),
  },
  tags: ['room-hourly-stays'],
  summary: 'Get hourly stays by room',
  description: 'Get all active hourly stay packages for a specific room',
};

export const getHourlyStaysByHotelSchema = {
  params: zodToJsonSchema(GetHourlyStaysByHotelParamsSchema),
  response: {
    200: zodToJsonSchema(GetHourlyStaysByHotelResponseSchema),
    500: zodToJsonSchema(ErrorResponseSchema),
  },
  tags: ['room-hourly-stays'],
  summary: 'Get hourly stays by hotel',
  description: 'Get all active hourly stay packages for all rooms in a hotel',
};

export const updateHourlyStaySchema = {
  params: zodToJsonSchema(HourlyStayParamsSchema),
  body: zodToJsonSchema(UpdateHourlyStayRequestSchema),
  response: {
    200: zodToJsonSchema(UpdateHourlyStayResponseSchema),
    400: zodToJsonSchema(ErrorResponseSchema),
    500: zodToJsonSchema(ErrorResponseSchema),
  },
  tags: ['room-hourly-stays'],
  summary: 'Update hourly stay package',
  description: 'Update an existing hourly stay package',
};

export const deleteHourlyStaySchema = {
  params: zodToJsonSchema(HourlyStayParamsSchema),
  response: {
    200: zodToJsonSchema(DeleteHourlyStayResponseSchema),
    500: zodToJsonSchema(ErrorResponseSchema),
  },
  tags: ['room-hourly-stays'],
  summary: 'Delete hourly stay package',
  description: 'Soft delete an hourly stay package (sets isActive to false)',
};
