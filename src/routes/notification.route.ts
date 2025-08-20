import { FastifyInstance } from 'fastify';
import { NotificationController } from '../controllers/notification.controller';
import {
  getUserNotificationsSchema,
  markAsReadSchema,
  markAllAsReadSchema,
  deleteNotificationSchema,
  sendNotificationSchema,
  sendEmailSchema,
  sendSMSSchema,
  registerTokenSchema,
  testNotificationSchema,
} from '../schemas/notification.schema';
import { rbacGuard } from '../plugins/rbacGuard';
import { permissions } from '../utils/rbac';

const notificationController = new NotificationController();

export default async function notificationRoutes(fastify: FastifyInstance) {
  // Set fastify instance in the service
  notificationController.setFastify(fastify);

  // All notification routes require authentication
  fastify.addHook('onRequest', fastify.authenticate);

  // Get user notifications
  fastify.get('/', {
    schema: {
      ...getUserNotificationsSchema,
      tags: ['notifications'],
      summary: 'Get user notifications',
      security: [{ bearerAuth: [] }]
    }
  }, (request, reply) => notificationController.getUserNotifications(request, reply));

  // Mark notification as read
  fastify.post('/mark-read', {
    schema: {
      ...markAsReadSchema,
      tags: ['notifications'],
      summary: 'Mark notification as read',
      security: [{ bearerAuth: [] }]
    }
  }, (request, reply) => notificationController.markAsRead(request, reply));

  // Mark all notifications as read
  fastify.post('/mark-all-read', {
    schema: {
      ...markAllAsReadSchema,
      tags: ['notifications'],
      summary: 'Mark all notifications as read',
      security: [{ bearerAuth: [] }]
    }
  }, (request, reply) => notificationController.markAllAsRead(request, reply));

  // Delete notification
  fastify.delete('/', {
    schema: {
      ...deleteNotificationSchema,
      tags: ['notifications'],
      summary: 'Delete notification',
      security: [{ bearerAuth: [] }]
    }
  }, (request, reply) => notificationController.deleteNotification(request, reply));

  // Send real-time notification (Admin only)
  fastify.post('/send', {
    schema: {
      ...sendNotificationSchema,
      tags: ['notifications'],
      summary: 'Send real-time notification',
      security: [{ bearerAuth: [] }]
    },
    preHandler: rbacGuard(permissions.viewAnalytics) // Using analytics permission as admin check
  }, (request, reply) => notificationController.sendNotification(request, reply));

  // Send email notification (Admin only)
  fastify.post('/send-email', {
    schema: {
      ...sendEmailSchema,
      tags: ['notifications'],
      summary: 'Send email notification',
      security: [{ bearerAuth: [] }]
    },
    preHandler: rbacGuard(permissions.viewAnalytics) // Using analytics permission as admin check
  }, (request, reply) => notificationController.sendEmail(request, reply));

  // Send SMS notification (Admin only)
  fastify.post('/send-sms', {
    schema: {
      ...sendSMSSchema,
      tags: ['notifications'],
      summary: 'Send SMS notification',
      security: [{ bearerAuth: [] }]
    },
    preHandler: rbacGuard(permissions.viewAnalytics) // Using analytics permission as admin check
  }, (request, reply) => notificationController.sendSMS(request, reply));

  // Register push token
  fastify.post('/register-token', {
    schema: {
      ...registerTokenSchema,
      tags: ['notifications'],
      summary: 'Register push token',
      security: [{ bearerAuth: [] }]
    }
  }, (request, reply) => notificationController.registerToken(request, reply));

  // Send test notification
  fastify.post('/test', {
    schema: {
      ...testNotificationSchema,
      tags: ['notifications'],
      summary: 'Send test notification',
      security: [{ bearerAuth: [] }]
    }
  }, (request, reply) => notificationController.testNotification(request, reply));

  

  // Send hotel vendor notification (Admin only)
  fastify.post('/send-hotel-vendor', {
    schema: {
      tags: ['notifications'],
      summary: 'Send notification to hotel vendors',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['hotelId', 'title', 'message'],
        properties: {
          hotelId: { type: 'string', format: 'uuid' },
          title: { type: 'string', minLength: 1 },
          message: { type: 'string', minLength: 1 },
          type: { type: 'string', enum: ['info', 'success', 'warning', 'error'] },
          data: { type: 'object' },
          requireInteraction: { type: 'boolean' }
        }
      }
    },
    preHandler: rbacGuard(permissions.viewAnalytics)
  }, (request, reply) => notificationController.sendHotelVendorNotification(request, reply));
}