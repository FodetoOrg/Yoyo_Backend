import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { ErrorResponseSchema, SuccessResponseSchema } from "../types/common";

// User schema
export const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().optional(),
  phone: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  status: z.enum(["active", "inactive"]),
});

// Auth tokens schema
export const AuthTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
});

// Request schemas
export const LoginRequestSchema = z.object({
  idToken: z.string(),
});

export const RefreshTokenRequestSchema = z.object({
  refreshToken: z.string(),
});

// Response schemas
export const LoginResponseSchema = z.object({
  success: z.boolean(),
  data: AuthTokensSchema,
});

export const RefreshTokenResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    accessToken: z.string(),
    refreshToken: z.string(),
  }),
});

export const VerifyTokenResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    message: z.string(),
  }),
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
    400: zodToJsonSchema(ErrorResponseSchema),
  },
  tags: ["auth"],
  summary: "Login with Firebase ID token and get JWT tokens",
};

export const refreshTokenSchema = {
  body: zodToJsonSchema(RefreshTokenRequestSchema),
  response: {
    200: zodToJsonSchema(RefreshTokenResponseSchema),
    400: zodToJsonSchema(ErrorResponseSchema),
  },
  tags: ["auth"],
  summary: "Refresh access token using refresh token",
};

export const verifyTokenSchema = {
  response: {
    200: zodToJsonSchema(VerifyTokenResponseSchema),
    400: zodToJsonSchema(ErrorResponseSchema),
  },
};

export const getAllUsersSchema = {
  query: zodToJsonSchema(
    z.object({
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(10),
      role: z.enum(["user", "hotel", "staff"]),
    })
  ),
  response: {
    200: zodToJsonSchema(
      z.object({
        success: z.boolean(),
        data: z.object({
          users: z.array(UserSchema),
          total: z.number(),
          page: z.number(),
          limit: z.number(),
        }),
      })
    ),
    400: zodToJsonSchema(ErrorResponseSchema),
  },
  tags: ["auth"],
  summary: "Get all users with pagination",
  security: [{ bearerAuth: [] }],
};

export const addHotelAdminSchema = {
  body: zodToJsonSchema(
    z.object({
      name: z.string(),
      phone: z.string(),
      email: z.string().email(),
    })
  ),
  response: {
    200: zodToJsonSchema(
      z.object({
        success: z.boolean(),
        data: z.object({
          hotelAdmin: UserSchema,
        }),
      })
    ),
    400: zodToJsonSchema(ErrorResponseSchema),
  },
  tags: ["auth"],
  summary: "Add hotel admin",
};

export const meSchema = {
  tags: ["auth"],
  summary: "Get user profile",
  security: [{ bearerAuth: [] }],
};

export const profileSchema = {
  tags: ["auth"],
  summary: "Get user profile",
  security: [{ bearerAuth: [] }],
};

export const updateProfileSchema = {
  tags: ["auth"],
  summary: "Update user profile",
  security: [{ bearerAuth: [] }],
};
