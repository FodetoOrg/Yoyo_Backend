import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

// Base schemas
export const NotificationSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  title: z.string(),
  message: z.string(),
  type: z.enum(['info', 'success', 'warning', 'error']),
  data: z.any().optional(),
  read: z.boolean(),
  timestamp: z.string().datetime(),
});

// Request schemas
export const GetUserNotificationsQuerySchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(10),
});

export const MarkAsReadRequestSchema = z.object({
  notificationId: z.string().uuid(),
});

export const DeleteNotificationRequestSchema = z.object({
  notificationId: z.string().uuid(),
});

export const SendNotificationRequestSchema = z.object({
  userId: z.string().uuid(),
  title: z.string().min(1),
  message: z.string().min(1),
  type: z.enum(['info', 'success', 'warning', 'error']).default('info'),
  data: z.any().optional(),
});

export const SendEmailRequestSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  html: z.string().min(1),
  text: z.string().optional(),
});

export const SendSMSRequestSchema = z.object({
  to: z.string().min(1),
  message: z.string().min(1),
});

// Response schemas
export const NotificationListResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    notifications: z.array(NotificationSchema),
    total: z.number().int().min(0),
    page: z.number().int().min(1),
    limit: z.number().int().min(1),
    totalPages: z.number().int().min(1),
    unreadCount: z.number().int().min(0),
  }),
});

export const NotificationResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: NotificationSchema,
});

export const MarkAllAsReadResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    success: z.boolean(),
    markedCount: z.number().int().min(0),
  }),
});

export const EmailResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    id: z.string().uuid(),
    to: z.string().email(),
    subject: z.string(),
    status: z.string(),
    timestamp: z.string().datetime(),
  }),
});

export const SMSResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    id: z.string().uuid(),
    to: z.string(),
    message: z.string(),
    status: z.string(),
    timestamp: z.string().datetime(),
  }),
});

export const DeleteNotificationResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

// Fastify schema objects
export const getUserNotificationsSchema = {
  querystring: zodToJsonSchema(GetUserNotificationsQuerySchema),
  response: {
    200: zodToJsonSchema(NotificationListResponseSchema),
  },
  tags: ['notifications'],
  summary: 'Get user notifications',
  description: 'Retrieve notifications for the authenticated user with pagination',
};

export const markAsReadSchema = {
  body: zodToJsonSchema(MarkAsReadRequestSchema),
  response: {
    200: zodToJsonSchema(NotificationResponseSchema),
    404: zodToJsonSchema(z.object({
      success: z.boolean(),
      message: z.string(),
    })),
  },
  tags: ['notifications'],
  summary: 'Mark notification as read',
  description: 'Mark a specific notification as read',
};

export const markAllAsReadSchema = {
  response: {
    200: zodToJsonSchema(MarkAllAsReadResponseSchema),
  },
  tags: ['notifications'],
  summary: 'Mark all notifications as read',
  description: 'Mark all notifications as read for the authenticated user',
};

export const deleteNotificationSchema = {
  body: zodToJsonSchema(DeleteNotificationRequestSchema),
  response: {
    200: zodToJsonSchema(DeleteNotificationResponseSchema),
    404: zodToJsonSchema(z.object({
      success: z.boolean(),
      message: z.string(),
    })),
  },
  tags: ['notifications'],
  summary: 'Delete notification',
  description: 'Delete a specific notification',
};

export const sendNotificationSchema = {
  body: zodToJsonSchema(SendNotificationRequestSchema),
  response: {
    201: zodToJsonSchema(NotificationResponseSchema),
  },
  tags: ['notifications'],
  summary: 'Send real-time notification',
  description: 'Send a real-time notification to a specific user (Admin only)',
};

export const sendEmailSchema = {
  body: zodToJsonSchema(SendEmailRequestSchema),
  response: {
    201: zodToJsonSchema(EmailResponseSchema),
  },
  tags: ['notifications'],
  summary: 'Send email notification',
  description: 'Send an email notification (Admin only)',
};

export const sendSMSSchema = {
  tags: ['notifications'],
  summary: 'Send SMS notification',
  body: {
    type: 'object',
    required: ['to', 'message'],
    properties: {
      to: { type: 'string', minLength: 1 },
      message: { type: 'string', minLength: 1 },
    },
  },
  response: {
    201: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: { type: 'object' },
      },
    },
    400: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        errors: { type: 'array' },
      },
    },
    500: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  },
};

export const registerTokenSchema = {
  tags: ['notifications'],
  summary: 'Register push token',
  body: {
    type: 'object',
    required: ['token', 'platform'],
    properties: {
      token: { type: 'string', minLength: 1 },
      platform: { type: 'string', enum: ['ios', 'android', 'web'] },
      deviceInfo: {
        type: 'object',
        properties: {
          brand: { type: 'string' },
          modelName: { type: 'string' },
          osName: { type: 'string' },
          osVersion: { type: 'string' },
        },
      },
    },
  },
  response: {
    201: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: { type: 'object' },
      },
    },
    400: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        errors: { type: 'array' },
      },
    },
    500: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  },
};

export const testNotificationSchema = {
  tags: ['notifications'],
  summary: 'Send test notification',
  body: {
    type: 'object',
    required: ['message'],
    properties: {
      message: { type: 'string', minLength: 1 },
    },
  },
  response: {
    201: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: { type: 'object' },
      },
    },
    400: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        errors: { type: 'array' },
      },
    },
    500: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  },
};