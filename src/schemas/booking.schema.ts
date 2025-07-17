import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

// Base schemas
export const BookingResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  hotelId: z.string(),
  roomId: z.string(),
  checkIn: z.string(),
  checkOut: z.string(),
  guests: z.number().int(),
  totalAmount: z.number(),
  status: z.enum(['pending', 'confirmed', 'cancelled', 'completed']),
  specialRequests: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});

// Create booking schemas
export const CreateBookingBodySchema = z.object({
  hotelId: z.string(),
  roomId: z.string(),
  checkIn: z.string(),
  checkOut: z.string(),
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

// Get all bookings schemas (admin)
export const GetAllBookingsQuerySchema = z.object({
  status: z.enum(['pending', 'confirmed', 'cancelled', 'completed']).optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(10)
});

export const GetUserBookingsResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    bookings: z.array(z.object({
      id: z.string().uuid(),
      checkInDate: z.string().datetime(),
      checkOutDate: z.string().datetime(),
      bookingType: z.string(),
      totalAmount: z.number(),
      status: z.string(),
      paymentStatus: z.string(),
      bookingDate: z.string().datetime(),
      hotel: z.object({
        id: z.string().uuid(),
        name: z.string(),
        city: z.string()
      }),
      room: z.object({
        id: z.string(),
        name: z.string(),
        roomType: z.string().optional()
      })
    })),
    total: z.number().int(),
    page: z.number().int().min(1),
    limit: z.number().int().min(1)
  })
});

export const GetAllBookingsResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    bookings: z.array(z.object({
      id: z.string().uuid(),
      checkInDate: z.string().datetime(),
      checkOutDate: z.string().datetime(),
      bookingType: z.string(),
      guestCount: z.number(),
      totalAmount: z.number(),
      paymentMode: z.string(),
      status: z.string(),
      paymentStatus: z.string(),
      bookingDate: z.string().datetime(),
      user: z.object({
        id: z.string().uuid(),
        name: z.string(),
        phone: z.string()
      }),
      hotel: z.object({
        id: z.string().uuid(),
        name: z.string(),
        city: z.string()
      }),
      room: z.object({
        id: z.string(),
        name: z.string(),
        roomType: z.string().optional()
      })
    })),
    total: z.number().int(),
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
    bookings: z.array(z.object({
      id: z.string().uuid(),
      checkInDate: z.string().datetime(),
      checkOutDate: z.string().datetime(),
      bookingType: z.string(),
      guestCount: z.number(),
      totalAmount: z.number(),
      paymentMode: z.string(),
      status: z.string(),
      paymentStatus: z.string(),
      bookingDate: z.string().datetime(),
      user: z.object({
        id: z.string().uuid(),
        name: z.string(),
        phone: z.string()
      }),
      room: z.object({
        id: z.string(),
        name: z.string(),
        roomType: z.string().optional()
      })
    })),
    total: z.number().int(),
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

// Booking details schemas
export const BookingDetailsResponseSchema = z.object({
  id: z.string(),
  bookingReference: z.string(),
  status: z.string(),
  hotelName: z.string(),
  hotelPhone: z.string(),
  hotelEmail: z.string(),
  address: z.string(),
  image: z.string(),
  roomType: z.string(),
  checkIn: z.string(),
  checkOut: z.string(),
  guests: z.number(),
  nights: z.number(),
  amenities: z.array(z.string()),
  priceBreakdown: z.object({
    roomRate: z.number(),
    subtotal: z.number(),
    taxes: z.number(),
    serviceFee: z.number()
  }),
  totalAmount: z.number(),
  cancellationPolicy: z.string()
});

export const GetBookingDetailsResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    booking: BookingDetailsResponseSchema
  })
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
    // 200: zodToJsonSchema(CancelBookingResponseSchema),
    404: zodToJsonSchema(CancelBookingErrorSchema)
  }
};

export const getBookingDetailsSchema = {
  params: zodToJsonSchema(GetBookingParamsSchema),
  response: {
    200: zodToJsonSchema(GetBookingDetailsResponseSchema),
    404: zodToJsonSchema(GetBookingErrorSchema)
  }
};

export const getAllBookingsSchema = {
  querystring: zodToJsonSchema(GetAllBookingsQuerySchema),
  response: {
    200: zodToJsonSchema(GetAllBookingsResponseSchema)
  }
}; 