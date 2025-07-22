import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

// Create addon schema
export const createAddonSchema = {
  body: zodToJsonSchema(z.object({
    name: z.string().min(1, 'Name is required'),
    description: z.string().optional(),
    image: z.string().optional(),
    price: z.number().min(0, 'Price must be non-negative'),
  })),
  params: zodToJsonSchema(z.object({
    hotelId: z.string(),
  })),
};

// Update addon schema
export const updateAddonSchema = {
  body: zodToJsonSchema(z.object({
    name: z.string().min(1, 'Name is required').optional(),
    description: z.string().optional(),
    image: z.string().optional(),
    price: z.number().min(0, 'Price must be non-negative').optional(),
    status: z.enum(['active', 'inactive']).optional(),
  })),
  params: zodToJsonSchema(z.object({
    hotelId: z.string(),
    addonId: z.string(),
  })),
};

// Get addon schema
export const getAddonSchema = {
  params: zodToJsonSchema(z.object({
    hotelId: z.string(),
    addonId: z.string().optional(),
  })),
};

// Update room addons schema
export const updateRoomAddonsSchema = {
  body: zodToJsonSchema(z.object({
    addonIds: z.array(z.string()),
  })),
  params: zodToJsonSchema(z.object({
    hotelId: z.string(),
    roomId: z.string(),
  })),
};

export const CreateAddonBodySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  image: z.string().url().optional(),
  price: z.number().min(0, 'Price must be non-negative'),
  hotelId: z.string().uuid('Invalid hotel ID'),
  applicableBookingTypes: z.enum(['daily', 'hourly', 'both']).default('both'),
});