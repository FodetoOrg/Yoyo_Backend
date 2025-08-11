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
  bookingType: z.enum(['daily', 'hourly']),
  specialRequests: z.string().nullable(),
  advanceAmount: z.number().min(0),
  remainingAmount: z.number().min(0),
  couponId: z.string().uuid().nullable(),
  discountAmount: z.number().min(0),
  createdAt: z.string(),
  updatedAt: z.string(),
  addons: z.array(z.object({
    id: z.string(),
    addonId: z.string(),
    name: z.string(),
    description: z.string(),
    image: z.string().optional(),
    quantity: z.number().int(),
    unitPrice: z.number(),
    totalPrice: z.number()
  })).optional(),
  payments: z.array(z.object({
    id: z.string(),
    amount: z.number(),
    status: z.string(),
    paymentMethod: z.string(),
    transactionDate: z.string()
  })).optional()
});

// Create booking schemas
export const CreateBookingBodySchema = z.object({
  hotelId: z.string(),
  roomId: z.string(),
  checkIn: z.string(),
  checkOut: z.string(),
  bookingType: z.enum(['daily', 'hourly']).default('daily'),
  guests: z.number().int().min(1),
  guestName: z.string().min(1, 'Guest name is required'),
  guestEmail: z.string().email('Invalid email'),
  guestPhone: z.string().min(1, 'Guest phone is required'),
  selectedAddons: z.array(z.object({
    id: z.string().uuid(),
    name: z.string(),
    description: z.string().optional(),
    image: z.string().optional(),
    price: z.number().positive(),
    quantity: z.number().int().positive(),
    status: z.string().optional()
  })).optional(),
  addons: z.array(z.object({
    addonId: z.string().uuid('Invalid addon ID'),
    quantity: z.number().min(1, 'Quantity must be at least 1'),
  })).optional(),
  paymentMode: z.enum(['online', 'offline']).optional(),
  advanceAmount: z.number().positive().optional(),
  couponCode: z.string().optional(),
  totalAmount: z.number(),
  
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
  limit: z.number().int().optional()
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
        roomType: z.string().optional(),
        iamge :z.string().optional()
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
      commissionAmount: z.number(),
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
      commissionAmount: z.number(),
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

// Update booking status schemas
export const UpdateBookingStatusParamsSchema = z.object({
  id: z.string().uuid()
});

export const UpdateBookingStatusBodySchema = z.object({
  status: z.enum(['confirmed', 'cancelled', 'checked-in', 'completed']),
  cancellationReason: z.string().optional()
});

export const UpdateBookingStatusResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    booking: BookingResponseSchema
  })
});

// Update guest details schemas
export const UpdateGuestDetailsParamsSchema = z.object({
  id: z.string().uuid()
});

export const UpdateGuestDetailsBodySchema = z.object({
  guestName: z.string().min(1, 'Guest name is required'),
  guestEmail: z.string().email('Invalid email'),
  guestPhone: z.string().min(1, 'Guest phone is required')
});

export const UpdateGuestDetailsResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    booking: BookingResponseSchema
  })
});

// Cancel booking with reason schemas
export const CancelBookingBodySchema = z.object({
  cancellationReason: z.string().min(1, 'Cancellation reason is required')
});

// Booking details schemas
export const BookingDetailsResponseSchema = z.object({
  id: z.string(),
  bookingReference: z.string(),
  status: z.string(),
  bookingType: z.enum(['daily', 'hourly']),
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
    serviceFee: z.number(),
    walletAmount:z.number()
  }),
  totalAmount: z.number(),
  cancellationPolicy: z.string(),
  refundInfo: z.object({
    id: z.string(),
    refundType: z.string(),
    originalAmount: z.number(),
    cancellationFeeAmount: z.number(),
    refundAmount: z.number(),
    cancellationFeePercentage: z.number(),
    refundReason: z.string(),
    status: z.string(),
    refundMethod: z.string(),
    expectedProcessingDays: z.number(),
    processedAt: z.string().datetime().nullable(),
    rejectionReason: z.string().nullable(),
    createdAt: z.string().datetime()
  }).nullable(),
  addons: z.array(z.object({
    id: z.string(),
    addonId: z.string(),
    name: z.string(),
    description: z.string(),
    image: z.string().optional(),
    quantity: z.number().int(),
    unitPrice: z.number(),
    totalPrice: z.number()
  }))
});

export const GetBookingDetailsResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    booking: BookingDetailsResponseSchema.extend({
      onlinePaymentEnabled: z.boolean(),
      paymentStaus:z.string(),
      paymentAmount:z.number().int(),
      latitude:z.number(),
      longitude:z.number(),
      guestName:z.string(),
      guestEmail:z.string(),
      guestPhone:z.string()

      
    })
  })
});

// Export Fastify schema objects
export const createBookingSchema = {
  body: zodToJsonSchema(CreateBookingBodySchema),
  response: {
    // 201: zodToJsonSchema(CreateBookingResponseSchema)
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
    // 200: zodToJsonSchema(GetUserBookingsResponseSchema)
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

export const updateBookingStatusSchema = {
  params: zodToJsonSchema(UpdateBookingStatusParamsSchema),
  body: zodToJsonSchema(UpdateBookingStatusBodySchema),
  response: {
    200: zodToJsonSchema(UpdateBookingStatusResponseSchema),
    404: zodToJsonSchema(GetBookingErrorSchema)
  }
};

export const updateGuestDetailsSchema = {
  params: zodToJsonSchema(UpdateGuestDetailsParamsSchema),
  body: zodToJsonSchema(UpdateGuestDetailsBodySchema),
  response: {
    200: zodToJsonSchema(UpdateGuestDetailsResponseSchema),
    404: zodToJsonSchema(GetBookingErrorSchema)
  }
};

export const cancelBookingWithReasonSchema = {
  params: zodToJsonSchema(CancelBookingParamsSchema),
  body: zodToJsonSchema(CancelBookingBodySchema),
  response: {
    200: zodToJsonSchema(CancelBookingResponseSchema),
    404: zodToJsonSchema(CancelBookingErrorSchema)
  }
};