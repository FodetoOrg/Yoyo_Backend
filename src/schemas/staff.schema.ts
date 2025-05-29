import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ErrorResponseSchema, SuccessResponseSchema } from '../types/common';

// Staff schemas
export const StaffSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  department: z.string().optional(),
  position: z.string().optional(),
  joiningDate: z.string().datetime(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    name: z.string().optional(),
    phone: z.string().optional(),
    role: z.string(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  }),
  permissions: z.array(z.object({
    id: z.string().uuid(),
    permissionKey: z.string(),
    permissionValue: z.string(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })),
});

export const StaffPermissionSchema = z.object({
  key: z.string(),
  value: z.string(),
});

// Request schemas
export const CreateStaffRequestSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  phone: z.string().optional(),
  department: z.string().optional(),
  position: z.string().optional(),
  permissions: z.array(StaffPermissionSchema),
  firebaseUid: z.string(),
});

export const UpdateStaffPermissionsRequestSchema = z.object({
  permissions: z.array(StaffPermissionSchema),
});

export const CheckPermissionRequestSchema = z.object({
  permissionKey: z.string(),
  permissionValue: z.string(),
});

// Response schemas
export const CreateStaffResponseSchema = z.object({
  success: z.boolean(),
  data: StaffSchema,
});

export const GetStaffResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(StaffSchema),
});

export const UpdateStaffPermissionsResponseSchema = z.object({
  success: z.boolean(),
  data: StaffSchema,
});

export const DeleteStaffResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export const CheckPermissionResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    hasPermission: z.boolean(),
  }),
});

// Types
export type Staff = z.infer<typeof StaffSchema>;
export type StaffPermission = z.infer<typeof StaffPermissionSchema>;
export type CreateStaffRequest = z.infer<typeof CreateStaffRequestSchema>;
export type UpdateStaffPermissionsRequest = z.infer<typeof UpdateStaffPermissionsRequestSchema>;
export type CheckPermissionRequest = z.infer<typeof CheckPermissionRequestSchema>;

// Fastify schema objects (for route configuration)
export const createStaffSchema = {
  body: zodToJsonSchema(CreateStaffRequestSchema),
  response: {
    200: zodToJsonSchema(CreateStaffResponseSchema),
    400: zodToJsonSchema(ErrorResponseSchema),
    403: zodToJsonSchema(ErrorResponseSchema),
  },
};

export const getStaffSchema = {
  response: {
    200: zodToJsonSchema(GetStaffResponseSchema),
    403: zodToJsonSchema(ErrorResponseSchema),
  },
};

export const updateStaffPermissionsSchema = {
  params: zodToJsonSchema(z.object({
    id: z.string().uuid(),
  })),
  body: zodToJsonSchema(UpdateStaffPermissionsRequestSchema),
  response: {
    200: zodToJsonSchema(UpdateStaffPermissionsResponseSchema),
    400: zodToJsonSchema(ErrorResponseSchema),
    403: zodToJsonSchema(ErrorResponseSchema),
  },
};

export const deleteStaffSchema = {
  params: zodToJsonSchema(z.object({
    id: z.string().uuid(),
  })),
  response: {
    200: zodToJsonSchema(DeleteStaffResponseSchema),
    403: zodToJsonSchema(ErrorResponseSchema),
  },
};

export const checkPermissionSchema = {
  body: zodToJsonSchema(CheckPermissionRequestSchema),
  response: {
    200: zodToJsonSchema(CheckPermissionResponseSchema),
    400: zodToJsonSchema(ErrorResponseSchema),
  },
}; 