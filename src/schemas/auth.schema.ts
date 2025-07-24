import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { ErrorResponseSchema, SuccessResponseSchema } from "../types/common";

// User schema
export const UserSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  phone: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  status: z.enum(["active", "inactive"]),
  role: z.string(),
  hasOnboarded: z.boolean(),
  hotelId: z.string().optional().nullable()
});

// Auth tokens schema
export const AuthTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),

});

// Request schemas
export const LoginRequestSchema = z.object({
  idToken: z.string(),
  role: z.enum(["user", "hotel", "staff", "superAdmin"]).default("user"),
});

export const RefreshTokenRequestSchema = z.object({
  refreshToken: z.string(),
});

export const LoginResponseSchema = z.object({
  success: z.boolean(),
  data: AuthTokensSchema.extend({
    user: UserSchema.extend({
      gender:z.string().nullable(),
      email:z.string().nullable()
    }),
  }),
});

export const RefreshTokenResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    accessToken: z.string(),
    refreshToken: z.string(),
    user: UserSchema,
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
  response: {
    200: zodToJsonSchema(
      z.object({
        success:z.boolean(),
        data: z.object({
          user: UserSchema,
        }),
      })
    ),
    400: zodToJsonSchema(ErrorResponseSchema),
  }
};

export const profileSchema = {
  tags: ["auth"],
  summary: "Get user profile",
  security: [{ bearerAuth: [] }],
};

// Update profile schemas
export const UpdateProfileRequestSchema = z.object({
  name: z.string().min(1).optional(),
  fullName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
  // Notification preferences (optional)
  bookingUpdates: z.boolean().optional(),
  checkinReminders: z.boolean().optional(),
  securityAlerts: z.boolean().optional(),
  promotionalOffers: z.boolean().optional(),
});

export const UpdateProfileResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    user: UserSchema,
    profile: z.object({
      fullName: z.string().nullable(),
      email: z.string().nullable(),
      gender: z.string().nullable(),
      notifications: z.object({
        bookingUpdates: z.boolean(),
        checkinReminders: z.boolean(),
        securityAlerts: z.boolean(),
        promotionalOffers: z.boolean(),
      })
    }).optional()
  }),
});

export const updateProfileSchema = {
  body: zodToJsonSchema(UpdateProfileRequestSchema),
  response: {
    200: zodToJsonSchema(UpdateProfileResponseSchema),
    400: zodToJsonSchema(ErrorResponseSchema),
    500: zodToJsonSchema(ErrorResponseSchema),
  },
  tags: ["auth"],
  summary: "Update user profile",
  description: "Update user profile. For customers, can update fullName, email, gender and notification preferences",
  security: [{ bearerAuth: [] }],
};
