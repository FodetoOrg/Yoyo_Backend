import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

// Base schemas
export const BookingResponseSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  hotelId: z.string().uuid(),
  roomId: z.string().uuid(),
  checkIn: z.string().datetime(),
  checkOut: z.string().datetime(),
  guests: z.number().int(),
  totalAmount: z.number(),
  status: z.enum(['pending', 'confirmed', 'cancelled', 'completed']),
  specialRequests: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

// Create booking schemas
export const CreateBookingBodySchema = z.object({
  hotelId: z.string().uuid(),
  roomId: z.string().uuid(),
  checkIn: z.string().datetime(),
  checkOut: z.string().datetime(),
  guests: z.number().int().min(1),
  specialRequests: z.string().optional(),
  paymentMode: z.enum(['online', 'offline']).optional(),
  advanceAmount: z.number().positive().optional()
});

export const CreateBookingResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    booking: BookingResponseSchema
  })
});

// Get booking by ID schemas
export const GetBookingParamsSchema = z.object({
  id: z.string().uuid()
});

export const GetBookingResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    booking: BookingResponseSchema
  })
});

export const GetBookingErrorSchema = z.object({
  success: z.boolean(),
  message: z.string()
});

// Get user bookings schemas
export const GetUserBookingsQuerySchema = z.object({
  status: z.enum(['pending', 'confirmed', 'cancelled', 'completed']).optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(10)
});

export const GetUserBookingsResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    bookings: z.array(BookingResponseSchema),
    total: z.number().int().min(0),
    page: z.number().int().min(1),
    limit: z.number().int().min(1)
  })
});

// Get hotel bookings schemas
export const GetHotelBookingsParamsSchema = z.object({
  id: z.string().uuid()
});

export const GetHotelBookingsResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    bookings: z.array(BookingResponseSchema),
    total: z.number().int().min(0),
    page: z.number().int().min(1),
    limit: z.number().int().min(1)
  })
});

// Cancel booking schemas
export const CancelBookingParamsSchema = z.object({
  id: z.string().uuid()
});

export const CancelBookingResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    booking: BookingResponseSchema
  })
});

export const CancelBookingErrorSchema = z.object({
  success: z.boolean(),
  message: z.string()
});

// Export Fastify schema objects
export const createBookingSchema = {
  body: zodToJsonSchema(CreateBookingBodySchema),
  response: {
    201: zodToJsonSchema(CreateBookingResponseSchema)
  }
};

export const getBookingByIdSchema = {
  params: zodToJsonSchema(GetBookingParamsSchema),
  response: {
    200: zodToJsonSchema(GetBookingResponseSchema),
    404: zodToJsonSchema(GetBookingErrorSchema)
  }
};

export const getUserBookingsSchema = {
  querystring: zodToJsonSchema(GetUserBookingsQuerySchema),
  response: {
    200: zodToJsonSchema(GetUserBookingsResponseSchema)
  }
};

export const getHotelBookingsSchema = {
  params: zodToJsonSchema(GetHotelBookingsParamsSchema),
  response: {
    200: zodToJsonSchema(GetHotelBookingsResponseSchema)
  }
};

export const cancelBookingSchema = {
  params: zodToJsonSchema(CancelBookingParamsSchema),
  response: {
    200: zodToJsonSchema(CancelBookingResponseSchema),
    404: zodToJsonSchema(CancelBookingErrorSchema)
  }
}; 