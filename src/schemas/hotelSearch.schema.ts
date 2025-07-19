import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

// Base schemas
export const CoordinatesSchema = z.object({
  lat: z.number(),
  lng: z.number(),
});

export const DateRangeSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
});

export const GuestsSchema = z.object({
  adults: z.number().int().min(1),
  children: z.number().int().min(0),
  infants: z.number().int().min(0),
});

export const PriceRangeSchema = z.object({
  min: z.number().optional(),
  max: z.number().optional(),
});

// Request schemas
export const SearchHotelsRequestSchema = z.object({
  coordinates: CoordinatesSchema.optional(),
  city: z.string().optional(),
  radius: z.number().default(50),
  dateRange: DateRangeSchema.optional(),
  guests: GuestsSchema,
  priceRange: PriceRangeSchema.optional(),
  starRating: z.number().int().min(0).max(5).optional(),
  amenities: z.array(z.string()).optional(),
  sortBy: z.enum(['recommended', 'price_low', 'price_high', 'rating', 'distance']).default('recommended'),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(50).default(10),
});

export const HomeTabQuerySchema = z.object({
  lat: z.number(),
  lng: z.number(),
  limit: z.number().int().min(1).max(20).default(10),
});

// Response schemas
export const HotelImageSchema = z.object({
  primary: z.string().url().nullable(),
  gallery: z.array(z.string().url()).optional(),
});

export const HotelRatingSchema = z.object({
  average: z.number().min(0).max(5),
  count: z.number().int().min(0),
});

export const HotelPricingSchema = z.object({
  startingFrom: z.number().min(0),
  range: z.object({
    min: z.number().min(0),
    max: z.number().min(0),
  }),
  currency: z.string(),
  totalPrice: z.number().nullable(),
  perNight: z.boolean(),
  availableRooms: z.number().optional()
});

export const HotelOfferSchema = z.object({
  title: z.string(),
  discountType: z.enum(['percentage', 'fixed']),
  discountValue: z.number(),
  code: z.string(),
  validUntil: z.string().datetime().optional(),
});

export const HotelSearchResultSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  address: z.string(),
  city: z.string(),
  starRating: z.number().min(0).max(5),
  amenities: z.array(z.string()),
  coordinates: CoordinatesSchema,
  distance: z.number().nullable(),
  rating: HotelRatingSchema,
  pricing: HotelPricingSchema.nullable(),
  offers: z.array(HotelOfferSchema).optional(),
  images: HotelImageSchema,
  paymentOptions: z.object({
    onlineEnabled: z.boolean(),
    offlineEnabled: z.boolean(),
  }),
});

export const HotelOffersResultSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  address: z.string(),
  city: z.string(),
  starRating: z.number().min(0).max(5),
  amenities: z.array(z.string()),
  coordinates: CoordinatesSchema,
  rating: HotelRatingSchema,
  pricing: HotelPricingSchema.nullable(),
  offers: z.array(HotelOfferSchema).optional(),
  images: HotelImageSchema,
  paymentOptions: z.object({
    onlineEnabled: z.boolean(),
    offlineEnabled: z.boolean(),
  }),
});

export const SearchHotelsResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    hotels: z.array(HotelSearchResultSchema),
    total: z.number().int().min(0),
    page: z.number().int().min(1),
    limit: z.number().int().min(1),
    totalPages: z.number().int().min(0),
    filters: z.object({
      appliedFilters: z.object({
        location: z.string(),
        dates: z.object({
          checkIn: z.string(),
          checkOut: z.string(),
        }).nullable(),
        guests: GuestsSchema,
        priceRange: PriceRangeSchema.nullable(),
        starRating: z.number().nullable(),
        amenities: z.array(z.string()).nullable(),
      }),
    }).optional(),
  }),
});

// Separate schema for latest hotels (no distance field)
export const LatestHotelResultSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  address: z.string(),
  city: z.string(),
  starRating: z.number().min(0).max(5),
  amenities: z.array(z.string()),
  coordinates: CoordinatesSchema,
  rating: HotelRatingSchema,
  pricing: HotelPricingSchema.extend({
    availableRooms: z.number().optional()
  }).nullable(),
  offers: z.array(HotelOfferSchema).optional(),
  images: HotelImageSchema,
  isNew: z.boolean().optional(),
  paymentOptions: z.object({
    onlineEnabled: z.boolean(),
    offlineEnabled: z.boolean(),
  }),
});

export const HomeTabResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    hotels: z.array(HotelSearchResultSchema),
    type: z.enum(['nearby', 'latest', 'offers']),
  }),
});

export const LatestHotelsResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    hotels: z.array(LatestHotelResultSchema), // Uses schema without distance field
    type: z.enum(['nearby', 'latest', 'offers']),
  }),
});

// Fastify schema objects
export const searchHotelsSchema = {
  body: zodToJsonSchema(SearchHotelsRequestSchema),
  response: {
    200: zodToJsonSchema(SearchHotelsResponseSchema),
    400: zodToJsonSchema(z.object({
      success: z.boolean(),
      message: z.string(),
      errors: z.array(z.any()).optional(),
    })),
  },
  tags: ['hotel-search'],
  summary: 'Search hotels with filters',
  description: 'Search hotels based on location, dates, guests, and various filters',
};

export const getNearbyHotelsSchema = {
  querystring: zodToJsonSchema(HomeTabQuerySchema),
  response: {
    200: zodToJsonSchema(HomeTabResponseSchema),
    400: zodToJsonSchema(z.object({
      success: z.boolean(),
      message: z.string(),
    })),
  },
  tags: ['hotel-search'],
  summary: 'Get nearby hotels',
  description: 'Get hotels near user location for home page',
};

export const getLatestHotelsSchema = {
  querystring: zodToJsonSchema(z.object({
    limit: z.number().int().min(1).max(20).default(10),
  })),
  response: {
    200: zodToJsonSchema(LatestHotelsResponseSchema), // Uses dedicated latest hotels schema
    500: zodToJsonSchema(z.object({
      success: z.boolean(),
      message: z.string(),
    })),
  },
  tags: ['hotel-search'],
  summary: 'Get latest hotels',
  description: 'Get recently added hotels for home page',
};

export const getOffersHotelsSchema = {
  querystring: zodToJsonSchema(z.object({
    limit: z.number().int().min(1).max(20).default(10),
  })),
  response: {
    // 200: zodToJsonSchema(HotelOffersResultSchema),
    500: zodToJsonSchema(z.object({
      success: z.boolean(),
      message: z.string(),
    })),
  },
  tags: ['hotel-search'],
  summary: 'Get hotels with offers',
  description: 'Get hotels with active offers/coupons for home page',
};