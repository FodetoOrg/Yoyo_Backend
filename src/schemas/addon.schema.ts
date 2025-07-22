
import { z } from 'zod';

// Create addon schema
export const createAddonSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required'),
    description: z.string().optional(),
    image: z.string().optional(),
    price: z.number().min(0, 'Price must be non-negative'),
  }),
  params: z.object({
    hotelId: z.string().uuid('Invalid hotel ID'),
  }),
});

// Update addon schema
export const updateAddonSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').optional(),
    description: z.string().optional(),
    image: z.string().optional(),
    price: z.number().min(0, 'Price must be non-negative').optional(),
    status: z.enum(['active', 'inactive']).optional(),
  }),
  params: z.object({
    hotelId: z.string().uuid('Invalid hotel ID'),
    addonId: z.string().uuid('Invalid addon ID'),
  }),
});

// Get addon schema
export const getAddonSchema = z.object({
  params: z.object({
    hotelId: z.string().uuid('Invalid hotel ID'),
    addonId: z.string().uuid('Invalid addon ID').optional(),
  }),
});

// Update room addons schema
export const updateRoomAddonsSchema = z.object({
  body: z.object({
    addonIds: z.array(z.string().uuid('Invalid addon ID')),
  }),
  params: z.object({
    hotelId: z.string().uuid('Invalid hotel ID'),
    roomId: z.string().uuid('Invalid room ID'),
  }),
});

export type CreateAddonInput = z.infer<typeof createAddonSchema>;
export type UpdateAddonInput = z.infer<typeof updateAddonSchema>;
export type GetAddonInput = z.infer<typeof getAddonSchema>;
export type UpdateRoomAddonsInput = z.infer<typeof updateRoomAddonsSchema>;
