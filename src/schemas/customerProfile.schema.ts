import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

// Base schemas
export const CustomerProfileSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  fullName: z.string().nullable(),
  email: z.string().email().nullable(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).nullable(),
  dateOfBirth: z.string().datetime().nullable(),
  profileImage: z.string().nullable(),
  bookingUpdatesEnabled: z.boolean(),
  checkinRemindersEnabled: z.boolean(),
  securityAlertsEnabled: z.boolean(),
  promotionalOffersEnabled: z.boolean(),
  preferredLanguage: z.string(),
  currency: z.string(),
  skippedOnboarding: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// Request schemas
export const UpdateProfileRequestSchema = z.object({
  fullName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
  dateOfBirth: z.string().datetime().optional(),
  profileImage: z.string().optional(),
  preferredLanguage: z.string().optional(),
  currency: z.string().optional(),
});

export const UpdateNotificationsRequestSchema = z.object({
  bookingUpdates: z.boolean().optional(),
  checkinReminders: z.boolean().optional(),
  securityAlerts: z.boolean().optional(),
  promotionalOffers: z.boolean().optional(),
});

export const CompleteOnboardingRequestSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  email: z.string().email('Valid email is required'),
  dateOfBirth: z.string().datetime().optional(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
});

// Response schemas
export const ProfileResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    id: z.string().uuid(),
    userId: z.string().uuid(),
    fullName: z.string().nullable(),
    email: z.string().email().nullable(),
    gender: z.string().nullable(),
    dateOfBirth: z.string().datetime().nullable(),
    profileImage: z.string().nullable(),
    phone: z.string().nullable(),
    notifications: z.object({
      bookingUpdates: z.boolean(),
      checkinReminders: z.boolean(),
      securityAlerts: z.boolean(),
      promotionalOffers: z.boolean(),
    }),
    preferences: z.object({
      language: z.string(),
      currency: z.string(),
    }),
    onboarding: z.object({
      skipped: z.boolean(),
    }),
    accountInfo: z.object({
      memberSince: z.string().datetime(),
      verified: z.boolean(),
    }),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  }),
});

export const UpdateProfileResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: ProfileResponseSchema.shape.data,
});

export const UpdateNotificationsResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: ProfileResponseSchema.shape.data,
});

export const CompleteOnboardingResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: ProfileResponseSchema.shape.data,
});

export const SkipOnboardingResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: ProfileResponseSchema.shape.data,
});

export const DeleteProfileResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

// Fastify schema objects
export const getProfileSchema = {
  response: {
    200: zodToJsonSchema(ProfileResponseSchema),
    404: zodToJsonSchema(z.object({
      success: z.boolean(),
      message: z.string(),
    })),
  },
  tags: ['customer-profile'],
  summary: 'Get customer profile',
  description: 'Get the authenticated customer\'s profile information',
};

export const updateProfileSchema = {
  body: zodToJsonSchema(UpdateProfileRequestSchema),
  response: {
    200: zodToJsonSchema(UpdateProfileResponseSchema),
    400: zodToJsonSchema(z.object({
      success: z.boolean(),
      message: z.string(),
      errors: z.array(z.any()).optional(),
    })),
    404: zodToJsonSchema(z.object({
      success: z.boolean(),
      message: z.string(),
    })),
  },
  tags: ['customer-profile'],
  summary: 'Update customer profile',
  description: 'Update the authenticated customer\'s profile information',
};

export const updateNotificationsSchema = {
  body: zodToJsonSchema(UpdateNotificationsRequestSchema),
  response: {
    200: zodToJsonSchema(UpdateNotificationsResponseSchema),
    400: zodToJsonSchema(z.object({
      success: z.boolean(),
      message: z.string(),
      errors: z.array(z.any()).optional(),
    })),
    404: zodToJsonSchema(z.object({
      success: z.boolean(),
      message: z.string(),
    })),
  },
  tags: ['customer-profile'],
  summary: 'Update notification preferences',
  description: 'Update the customer\'s notification preferences',
};

export const completeOnboardingSchema = {
  body: zodToJsonSchema(CompleteOnboardingRequestSchema),
  response: {
    200: zodToJsonSchema(CompleteOnboardingResponseSchema),
    400: zodToJsonSchema(z.object({
      success: z.boolean(),
      message: z.string(),
      errors: z.array(z.any()).optional(),
    })),
  },
  tags: ['customer-profile'],
  summary: 'Complete customer onboarding',
  description: 'Complete the customer onboarding process with required information',
};

export const skipOnboardingSchema = {
  response: {
    200: zodToJsonSchema(SkipOnboardingResponseSchema),
    500: zodToJsonSchema(z.object({
      success: z.boolean(),
      message: z.string(),
    })),
  },
  tags: ['customer-profile'],
  summary: 'Skip customer onboarding',
  description: 'Skip the customer onboarding process and create profile with default values',
};

export const deleteProfileSchema = {
  response: {
    200: zodToJsonSchema(DeleteProfileResponseSchema),
    500: zodToJsonSchema(z.object({
      success: z.boolean(),
      message: z.string(),
    })),
  },
  tags: ['customer-profile'],
  summary: 'Delete customer profile',
  description: 'Delete the authenticated customer\'s profile',
};