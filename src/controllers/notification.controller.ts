// @ts-nocheck
import { FastifyRequest, FastifyReply } from 'fastify';
import { NotificationService } from '../services/notification.service';
import { z } from 'zod';

const getUserNotificationsSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(10),
});

const markAsReadSchema = z.object({
  notificationId: z.string().uuid(),
});

const deleteNotificationSchema = z.object({
  notificationId: z.string().uuid(),
});

const sendNotificationSchema = z.object({
  userId: z.string().uuid(),
  title: z.string().min(1),
  message: z.string().min(1),
  type: z.enum(['info', 'success', 'warning', 'error']).default('info'),
  data: z.any().optional(),
});

const sendEmailSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  html: z.string().min(1),
  text: z.string().optional(),
});

const sendSMSSchema = z.object({
  to: z.string().min(1),
  message: z.string().min(1),
});

const registerTokenSchema = z.object({
  token: z.string().min(1),
  platform: z.enum(['ios', 'android', 'web']),
  deviceInfo: z.object({
    brand: z.string().optional(),
    modelName: z.string().optional(),
    osName: z.string().optional(),
    osVersion: z.string().optional(),
  }).optional(),
});

const testNotificationSchema = z.object({
  message: z.string().min(1),
});



const sendHotelVendorNotificationSchema = z.object({
  hotelId: z.string().uuid(),
  title: z.string().min(1),
  message: z.string().min(1),
  type: z.enum(['info', 'success', 'warning', 'error']).default('info'),
  data: z.any().optional(),
  requireInteraction: z.boolean().default(false),
});

export class NotificationController {
  private notificationService: NotificationService;

  constructor() {
    this.notificationService = new NotificationService();
  }

  setFastify(fastify: any) {
    this.notificationService.setFastify(fastify);
  }

  // Get user notifications
  async getUserNotifications(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = (request as any).user.id;
      const { page, limit } = getUserNotificationsSchema.parse(request.query);
      
      const result = await this.notificationService.getUserNotifications(userId, page, limit);
      
      return reply.code(200).send({
        success: true,
        data: result,
      });
    } catch (error) {
      request.log.error(error);
      
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
      }
      
      return reply.code(500).send({
        success: false,
        message: error.message || 'Failed to fetch notifications',
      });
    }
  }

  // Mark notification as read
  async markAsRead(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = (request as any).user.id;
      const { notificationId } = markAsReadSchema.parse(request.body);
      
      const notification = await this.notificationService.markAsRead(userId, notificationId);
      
      return reply.code(200).send({
        success: true,
        message: 'Notification marked as read',
        data: notification,
      });
    } catch (error) {
      request.log.error(error);
      
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
      }
      
      const statusCode = error.message === 'Notification not found' ? 404 : 500;
      return reply.code(statusCode).send({
        success: false,
        message: error.message || 'Failed to mark notification as read',
      });
    }
  }

  // Mark all notifications as read
  async markAllAsRead(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = (request as any).user.id;
      const result = await this.notificationService.markAllAsRead(userId);
      
      return reply.code(200).send({
        success: true,
        message: 'All notifications marked as read',
        data: result,
      });
    } catch (error) {
      request.log.error(error);
      
      return reply.code(500).send({
        success: false,
        message: error.message || 'Failed to mark all notifications as read',
      });
    }
  }

  // Delete notification
  async deleteNotification(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = (request as any).user.id;
      const { notificationId } = deleteNotificationSchema.parse(request.body);
      
      await this.notificationService.deleteNotification(userId, notificationId);
      
      return reply.code(200).send({
        success: true,
        message: 'Notification deleted successfully',
      });
    } catch (error) {
      request.log.error(error);
      
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
      }
      
      const statusCode = error.message === 'Notification not found' ? 404 : 500;
      return reply.code(statusCode).send({
        success: false,
        message: error.message || 'Failed to delete notification',
      });
    }
  }

  // Send real-time notification (Admin only)
  async sendNotification(request: FastifyRequest, reply: FastifyReply) {
    try {
      const notificationData = sendNotificationSchema.parse(request.body);
      const notification = await this.notificationService.sendRealTimeNotification(notificationData);
      
      return reply.code(201).send({
        success: true,
        message: 'Notification sent successfully',
        data: notification,
      });
    } catch (error) {
      request.log.error(error);
      
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
      }
      
      return reply.code(500).send({
        success: false,
        message: error.message || 'Failed to send notification',
      });
    }
  }

  // Send email notification (Admin only)
  async sendEmail(request: FastifyRequest, reply: FastifyReply) {
    try {
      const emailData = sendEmailSchema.parse(request.body);
      const result = await this.notificationService.sendEmailNotification(emailData);
      
      return reply.code(201).send({
        success: true,
        message: 'Email sent successfully',
        data: result,
      });
    } catch (error) {
      request.log.error(error);
      
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
      }
      
      return reply.code(500).send({
        success: false,
        message: error.message || 'Failed to send email',
      });
    }
  }

  // Send SMS notification (Admin only)
  async sendSMS(request: FastifyRequest, reply: FastifyReply) {
    try {
      const smsData = sendSMSSchema.parse(request.body);
      const result = await this.notificationService.sendSMSNotification(smsData);
      
      return reply.code(201).send({
        success: true,
        message: 'SMS sent successfully',
        data: result,
      });
    } catch (error) {
      request.log.error(error);
      
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
      }
      
      return reply.code(500).send({
        success: false,
        message: error.message || 'Failed to send SMS',
      });
    }
  }

  // Register push token
  async registerToken(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = (request as any).user.id;
      const { token, platform, deviceInfo } = registerTokenSchema.parse(request.body);

      console.log('token, platform, deviceInfo ',token)
      console.log(platform)
      console.log('deviceInfo ',deviceInfo)
      
      // Generate device ID from user and platform info
      const deviceId = `${userId}-${platform}-${Date.now()}`;
      
      const result = await this.notificationService.registerPushToken(
        userId, 
        token, 
        deviceId, 
        platform, 
        deviceInfo
      );
      
      return reply.code(201).send({
        success: true,
        message: 'Push token registered successfully',
        data: result,
      });
    } catch (error) {
      request.log.error(error);
      
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
      }
      
      return reply.code(500).send({
        success: false,
        message: error.message || 'Failed to register push token',
      });
    }
  }

  // Send test notification
  async testNotification(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = (request as any).user.id;
      const { message } = testNotificationSchema.parse(request.body);
      
      const result = await this.notificationService.sendTestNotification(userId, message);
      
      return reply.code(201).send({
        success: true,
        message: 'Test notification sent successfully',
        data: result,
      });
    } catch (error) {
      request.log.error(error);
      
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
      }
      
      return reply.code(500).send({
        success: false,
        message: error.message || 'Failed to send test notification',
      });
    }
  }


  // Get VAPID public key
  async getVapidPublicKey(request: FastifyRequest, reply: FastifyReply) {
    try {
      const publicKey = this.notificationService.getVapidPublicKey();
      
      return reply.code(200).send({
        success: true,
        data: { publicKey },
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        message: 'Failed to get VAPID public key',
      });
    }
  }

  // Subscribe to web push notifications
  async subscribeWebPush(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { subscription } = request.body as any;
      const userId = (request as any).user.id;
      
      const result = await this.notificationService.subscribeUserToWebPush(userId, subscription);
      
      return reply.code(201).send({
        success: true,
        message: 'Successfully subscribed to web push notifications',
        data: result,
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        message: 'Failed to subscribe to web push notifications',
      });
    }
  }

  // Unsubscribe from web push notifications
  async unsubscribeWebPush(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { endpoint } = request.body as any;
      const userId = (request as any).user.id;
      
      const result = await this.notificationService.unsubscribeUserFromWebPush(userId, endpoint);
      
      return reply.code(200).send({
        success: true,
        message: 'Successfully unsubscribed from web push notifications',
        data: result,
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        message: 'Failed to unsubscribe from web push notifications',
      });
    }
  }

  // Send test web push notification
  async sendTestWebPush(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { message } = request.body as any;
      const userId = (request as any).user.id;
      
      const result = await this.notificationService.sendWebPushNotification({
        userId,
        title: 'Test Web Push Notification',
        message,
        type: 'info',
        requireInteraction: true
      });
      
      return reply.code(201).send({
        success: true,
        message: 'Test web push notification sent',
        data: result,
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        message: 'Failed to send test web push notification',
      });
    }
  }

  // Send web push to all admins
  async sendAdminWebPush(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { title, message, type = 'info', data, requireInteraction } = request.body as any;
      
      const result = await this.notificationService.sendAdminWebPushNotification({
        title,
        message,
        type,
        data,
        requireInteraction
      });
      
      return reply.code(201).send({
        success: true,
        message: 'Admin web push notifications sent',
        data: result,
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        message: 'Failed to send admin web push notifications',
      });
    }
  }

  // Send web push to hotel vendors
  async sendHotelVendorWebPush(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { hotelId, title, message, type = 'info', data, requireInteraction } = request.body as any;
      
      const result = await this.notificationService.sendHotelVendorWebPushNotification(hotelId, {
        title,
        message,
        type,
        data,
        requireInteraction
      });
      
      return reply.code(201).send({
        success: true,
        message: 'Hotel vendor web push notifications sent',
        data: result,
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        message: 'Failed to send hotel vendor web push notifications',
      });
    }
  }

  // Send hotel vendor notification
  async sendHotelVendorNotification(request: FastifyRequest, reply: FastifyReply) {
    try {
      const notificationData = sendHotelVendorNotificationSchema.parse(request.body);
      const result = await this.notificationService.sendHotelVendorWebNotification(
        notificationData.hotelId,
        {
          title: notificationData.title,
          message: notificationData.message,
          type: notificationData.type,
          data: notificationData.data,
          requireInteraction: notificationData.requireInteraction
        }
      );
      
      return reply.code(201).send({
        success: true,
        message: 'Hotel vendor notification sent successfully',
        data: result,
      });
    } catch (error) {
      request.log.error(error);
      
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
      }
      
      return reply.code(500).send({
        success: false,
        message: error.message || 'Failed to send hotel vendor notification',
      });
    }
  }
}