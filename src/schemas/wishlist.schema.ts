import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

// Request schemas
export const AddToWishlistSchema = z.object({
  hotelId: z.string().uuid(),
});

export const RemoveFromWishlistSchema = z.object({
  hotelId: z.string().uuid(),
});

export const CheckWishlistSchema = z.object({
  hotelId: z.string().uuid(),
});

export const WishlistQuerySchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(50).default(10),
});

// Hotel schema for wishlist that matches the actual returned data
export const WishlistHotelSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  address: z.string(),
  city: z.string(),
  starRating: z.number().int(),
  amenities: z.array(z.string()),
  coordinates: z.object({
    lat: z.number(),
    lng: z.number(),
  }),
  rating: z.object({
    average: z.number(),
    count: z.number().int(),
  }),
  pricing: z.object({
    startingFrom: z.number(),
    range: z.object({
      min: z.number(),
      max: z.number(),
    }),
    currency: z.string(),
    perNight: z.boolean(),
  }).nullable(),
  images: z.object({
    primary: z.string().url().nullable(),
  }),
  paymentOptions: z.object({
    onlineEnabled: z.boolean(),
    offlineEnabled: z.boolean(),
  }),
});

// Response schemas
export const WishlistItemSchema = z.object({
  id: z.string().uuid(),
  addedAt: z.string().datetime(),
  hotel: WishlistHotelSchema,
});

export const WishlistResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    items: z.array(WishlistItemSchema),
    total: z.number().int().min(0),
    page: z.number().int().min(1),
    limit: z.number().int().min(1),
    totalPages: z.number().int().min(1),
  }),
});

export const AddToWishlistResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    id: z.string().uuid(),
    message: z.string(),
    hotel: z.object({
      id: z.string().uuid(),
      name: z.string(),
    }),
  }),
});

export const RemoveFromWishlistResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    message: z.string(),
  }),
});

export const CheckWishlistResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    isInWishlist: z.boolean(),
    addedAt: z.string().datetime().nullable(),
  }),
});

export const WishlistCountResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    count: z.number().int().min(0),
  }),
});

export const ClearWishlistResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    message: z.string(),
    removedCount: z.number().int().min(0),
  }),
});

// Fastify schema objects
export const getWishlistSchema = {
  querystring: zodToJsonSchema(WishlistQuerySchema),
  response: {
    200: zodToJsonSchema(WishlistResponseSchema),
    500: zodToJsonSchema(z.object({
      success: z.boolean(),
      message: z.string(),
    })),
  },
  tags: ['wishlist'],
  summary: 'Get user wishlist',
  description: 'Get the authenticated user\'s wishlist with pagination',
};

export const addToWishlistSchema = {
  body: zodToJsonSchema(AddToWishlistSchema),
  response: {
    201: zodToJsonSchema(AddToWishlistResponseSchema),
    400: zodToJsonSchema(z.object({
      success: z.boolean(),
      message: z.string(),
    })),
    404: zodToJsonSchema(z.object({
      success: z.boolean(),
      message: z.string(),
    })),
    409: zodToJsonSchema(z.object({
      success: z.boolean(),
      message: z.string(),
    })),
  },
  tags: ['wishlist'],
  summary: 'Add hotel to wishlist',
  description: 'Add a hotel to the user\'s wishlist',
};

export const removeFromWishlistSchema = {
  body: zodToJsonSchema(RemoveFromWishlistSchema),
  response: {
    200: zodToJsonSchema(RemoveFromWishlistResponseSchema),
    400: zodToJsonSchema(z.object({
      success: z.boolean(),
      message: z.string(),
    })),
    404: zodToJsonSchema(z.object({
      success: z.boolean(),
      message: z.string(),
    })),
  },
  tags: ['wishlist'],
  summary: 'Remove hotel from wishlist',
  description: 'Remove a hotel from the user\'s wishlist',
};

export const checkWishlistSchema = {
  querystring: zodToJsonSchema(CheckWishlistSchema),
  response: {
    200: zodToJsonSchema(CheckWishlistResponseSchema),
    400: zodToJsonSchema(z.object({
      success: z.boolean(),
      message: z.string(),
    })),
  },
  tags: ['wishlist'],
  summary: 'Check if hotel is in wishlist',
  description: 'Check if a specific hotel is in the user\'s wishlist',
};

export const getWishlistCountSchema = {
  response: {
    200: zodToJsonSchema(WishlistCountResponseSchema),
    500: zodToJsonSchema(z.object({
      success: z.boolean(),
      message: z.string(),
    })),
  },
  tags: ['wishlist'],
  summary: 'Get wishlist count',
  description: 'Get the total number of hotels in user\'s wishlist',
};

export const clearWishlistSchema = {
  response: {
    200: zodToJsonSchema(ClearWishlistResponseSchema),
    500: zodToJsonSchema(z.object({
      success: z.boolean(),
      message: z.string(),
    })),
  },
  tags: ['wishlist'],
  summary: 'Clear wishlist',
  description: 'Remove all hotels from the user\'s wishlist',
};