import { z } from 'zod';

// Common response wrapper
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    code: string;
    details?: any;
  };
}

// Common pagination params
export const PaginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(10)
});

export type PaginationParams = z.infer<typeof PaginationSchema>;

// Common response schemas
export const ErrorResponseSchema = z.object({
  success: z.literal(false),
  message: z.string(),
  error: z.object({
    code: z.string(),
    details: z.any().optional()
  })
});

export const SuccessResponseSchema = <T extends z.ZodType>(dataSchema: T) => z.object({
  success: z.literal(true),
  message: z.string().optional(),
  data: dataSchema
});

// Common validation error types
export interface ValidationError {
  field: string;
  message: string;
}

// HTTP Status codes enum
export enum HttpStatus {
  OK = 200,
  CREATED = 201,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  CONFLICT = 409,
  INTERNAL_SERVER_ERROR = 500
}

// Error codes enum
export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  NOT_FOUND = 'NOT_FOUND',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  CONFLICT = 'CONFLICT'
} 

export enum UserRole {
  USER = 'user',
  HOTEL_ADMIN = 'hotel',
  STAFF = 'staff'
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive'
}