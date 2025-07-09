import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

// Base schemas
export const RoomTypeSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(['active', 'inactive']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// Request schemas
export const CreateRoomTypeRequestSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  status: z.enum(['active', 'inactive']).default('active'),
});

export const UpdateRoomTypeRequestSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

export const RoomTypeParamsSchema = z.object({
  id: z.string().uuid(),
});

// Response schemas
export const RoomTypeResponseSchema = z.object({
  success: z.boolean(),
  data: RoomTypeSchema,
});

export const RoomTypeListResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(RoomTypeSchema),
});

export const DeleteRoomTypeResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

// Fastify schema objects
export const getRoomTypesSchema = {
  response: {
    200: zodToJsonSchema(RoomTypeListResponseSchema),
  },
  tags: ['room-types'],
  summary: 'Get all room types',
  description: 'Retrieve all room types ordered by name',
};

export const getRoomTypeByIdSchema = {
  params: zodToJsonSchema(RoomTypeParamsSchema),
  response: {
    200: zodToJsonSchema(RoomTypeResponseSchema),
    404: zodToJsonSchema(z.object({
      success: z.boolean(),
      message: z.string(),
    })),
  },
  tags: ['room-types'],
  summary: 'Get room type by ID',
  description: 'Retrieve a specific room type by its ID',
};

export const createRoomTypeSchema = {
  body: zodToJsonSchema(CreateRoomTypeRequestSchema),
  response: {
    201: zodToJsonSchema(RoomTypeResponseSchema),
    409: zodToJsonSchema(z.object({
      success: z.boolean(),
      message: z.string(),
    })),
  },
  tags: ['room-types'],
  summary: 'Create a new room type',
  description: 'Create a new room type (Super admin only)',
};

export const updateRoomTypeSchema = {
  params: zodToJsonSchema(RoomTypeParamsSchema),
  body: zodToJsonSchema(UpdateRoomTypeRequestSchema),
  response: {
    200: zodToJsonSchema(RoomTypeResponseSchema),
    404: zodToJsonSchema(z.object({
      success: z.boolean(),
      message: z.string(),
    })),
    409: zodToJsonSchema(z.object({
      success: z.boolean(),
      message: z.string(),
    })),
  },
  tags: ['room-types'],
  summary: 'Update room type',
  description: 'Update an existing room type (Super admin only)',
};

export const deleteRoomTypeSchema = {
  params: zodToJsonSchema(RoomTypeParamsSchema),
  response: {
    200: zodToJsonSchema(DeleteRoomTypeResponseSchema),
    404: zodToJsonSchema(z.object({
      success: z.boolean(),
      message: z.string(),
    })),
    409: zodToJsonSchema(z.object({
      success: z.boolean(),
      message: z.string(),
    })),
  },
  tags: ['room-types'],
  summary: 'Delete room type',
  description: 'Delete an existing room type (Super admin only)',
};