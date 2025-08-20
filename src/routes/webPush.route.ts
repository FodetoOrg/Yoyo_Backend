
import { FastifyInstance } from 'fastify';
import { NotificationController } from '../controllers/notification.controller';
import { rbacGuard } from '../plugins/rbacGuard';
import { permissions } from '../utils/rbac';

export default async function webPushRoutes(fastify: FastifyInstance) {
  const notificationController = new NotificationController();
  notificationController['webpushNotificationService'].setFastify(fastify)

  // Get VAPID public key
  fastify.get('/vapid-public-key', {
    schema: {
      tags: ['web-push'],
      summary: 'Get VAPID public key for web push subscriptions'
    }
  }, (request, reply) => notificationController.getVapidPublicKey(request, reply));

  // Subscribe to web push notifications
  fastify.post('/subscribe', {
    schema: {
      tags: ['web-push'],
      summary: 'Subscribe to web push notifications',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['subscription'],
        properties: {
          subscription: {
            type: 'object',
            required: ['endpoint', 'keys'],
            properties: {
              endpoint: { type: 'string' },
              keys: {
                type: 'object',
                required: ['p256dh', 'auth'],
                properties: {
                  p256dh: { type: 'string' },
                  auth: { type: 'string' }
                }
              }
            }
          }
        }
      }
    },
    preHandler: [fastify.authenticate]
  }, (request, reply) => notificationController.subscribeWebPush(request, reply));

  // Unsubscribe from web push notifications
  fastify.post('/unsubscribe', {
    schema: {
      tags: ['web-push'],
      summary: 'Unsubscribe from web push notifications',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['endpoint'],
        properties: {
          endpoint: { type: 'string' }
        }
      }
    },
    preHandler: [fastify.authenticate]
  }, (request, reply) => notificationController.unsubscribeWebPush(request, reply));

  // Send test web push notification
  fastify.post('/test', {
    schema: {
      tags: ['web-push'],
      summary: 'Send test web push notification',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['message'],
        properties: {
          message: { type: 'string' }
        }
      }
    },
    preHandler: [fastify.authenticate]
  }, (request, reply) => notificationController.sendTestWebPush(request, reply));

  // Send web push to admin (Admin only)
  fastify.post('/send-admin', {
    schema: {
      tags: ['web-push'],
      summary: 'Send web push notification to all admins',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['title', 'message'],
        properties: {
          title: { type: 'string' },
          message: { type: 'string' },
          type: { type: 'string', enum: ['info', 'success', 'warning', 'error'] },
          data: { type: 'object' },
          requireInteraction: { type: 'boolean' }
        }
      }
    },
    preHandler: rbacGuard(permissions.viewAnalytics)
  }, (request, reply) => notificationController.sendAdminWebPush(request, reply));

  // Send web push to hotel vendor (Admin only)
  fastify.post('/send-hotel-vendor', {
    schema: {
      tags: ['web-push'],
      summary: 'Send web push notification to hotel vendors',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['hotelId', 'title', 'message'],
        properties: {
          hotelId: { type: 'string' },
          title: { type: 'string' },
          message: { type: 'string' },
          type: { type: 'string', enum: ['info', 'success', 'warning', 'error'] },
          data: { type: 'object' },
          requireInteraction: { type: 'boolean' }
        }
      }
    },
    preHandler: rbacGuard(permissions.viewAnalytics)
  }, (request, reply) => notificationController.sendHotelVendorWebPush(request, reply));
}
