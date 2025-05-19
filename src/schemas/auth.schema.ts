import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ErrorResponseSchema, SuccessResponseSchema } from '../types/common';

// User schema
export const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().optional(),
  phone: z.string().optional(),
  role: z.enum(['user', 'hotel_owner', 'admin']),
  firebaseUid: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

// Auth tokens schema
export const AuthTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: UserSchema
});

// Request schemas
export const LoginRequestSchema = z.object({
  idToken: z.string()
});

export const RefreshTokenRequestSchema = z.object({
  refreshToken: z.string()
});

// Response schemas
export const LoginResponseSchema = z.object({
  success: z.boolean(),
  data: AuthTokensSchema
});

export const RefreshTokenResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    accessToken: z.string(),
    refreshToken: z.string()
  })
});

// Types
export type User = z.infer<typeof UserSchema>;
export type AuthTokens = z.infer<typeof AuthTokensSchema>;
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type RefreshTokenRequest = z.infer<typeof RefreshTokenRequestSchema>;

// Fastify schema objects (for route configuration)
export const loginSchema = {
  body: zodToJsonSchema(LoginRequestSchema),
  response: {
    200: zodToJsonSchema(LoginResponseSchema),
    400: zodToJsonSchema(ErrorResponseSchema)
  }
};

export const refreshTokenSchema = {
  body: zodToJsonSchema(RefreshTokenRequestSchema),
  response: {
    200: zodToJsonSchema(RefreshTokenResponseSchema),
    400: zodToJsonSchema(ErrorResponseSchema)
  }
}; 