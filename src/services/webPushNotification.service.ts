
// @ts-nocheck
import { FastifyInstance } from "fastify";
import { notifications, users } from "../models/schema";
import { eq, and, desc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import * as webpush from 'web-push';

interface WebPushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

interface WebPushNotificationData {
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  data?: any;
  icon?: string;
  badge?: string;
  image?: string;
  requireInteraction?: boolean;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  url?: string; // URL to open when notification is clicked
}

export class WebPushNotificationService {
  private fastify!: FastifyInstance;
  private userSubscriptions: Map<string, WebPushSubscription[]> = new Map();

  constructor() {
    // Configure VAPID details for Web Push
    webpush.setVapidDetails(
      'mailto:support@yoyolite.com',
      process.env.VAPID_PUBLIC_KEY || this.generateVapidKeys().publicKey,
      process.env.VAPID_PRIVATE_KEY || this.generateVapidKeys().privateKey
    );
  }

  setFastify(fastify: FastifyInstance) {
    this.fastify = fastify;
  }

  // Generate VAPID keys if not provided
  private generateVapidKeys() {
    const vapidKeys = webpush.generateVAPIDKeys();
    console.log('Generated VAPID Keys - Add these to your environment variables:');
    console.log('VAPID_PUBLIC_KEY:', vapidKeys.publicKey);
    console.log('VAPID_PRIVATE_KEY:', vapidKeys.privateKey);
    return vapidKeys;
  }

  // Get VAPID public key for client-side subscription
  getVapidPublicKey(): string {
    return process.env.VAPID_PUBLIC_KEY || webpush.generateVAPIDKeys().publicKey;
  }

  // Subscribe user to web push notifications
  async subscribeUser(userId: string, subscription: WebPushSubscription) {
    try {
      if (!this.userSubscriptions.has(userId)) {
        this.userSubscriptions.set(userId, []);
      }

      const userSubs = this.userSubscriptions.get(userId)!;
      
      // Check if subscription already exists
      const existingIndex = userSubs.findIndex(sub => sub.endpoint === subscription.endpoint);
      
      if (existingIndex >= 0) {
        // Update existing subscription
        userSubs[existingIndex] = subscription;
      } else {
        // Add new subscription
        userSubs.push(subscription);
      }

      console.log(`Web push subscription added for user ${userId}. Total subscriptions: ${userSubs.length}`);
      
      return {
        success: true,
        message: 'Successfully subscribed to web push notifications'
      };

    } catch (error) {
      console.error('Failed to subscribe user:', error);
      throw error;
    }
  }

  // Unsubscribe user from web push notifications
  async unsubscribeUser(userId: string, endpoint: string) {
    try {
      const userSubs = this.userSubscriptions.get(userId);
      if (!userSubs) {
        return { success: false, message: 'No subscriptions found' };
      }

      const filteredSubs = userSubs.filter(sub => sub.endpoint !== endpoint);
      this.userSubscriptions.set(userId, filteredSubs);

      console.log(`Web push subscription removed for user ${userId}. Remaining: ${filteredSubs.length}`);
      
      return {
        success: true,
        message: 'Successfully unsubscribed from web push notifications'
      };

    } catch (error) {
      console.error('Failed to unsubscribe user:', error);
      throw error;
    }
  }

  // Send web push notification to specific user
  async sendWebPushNotification(data: WebPushNotificationData) {
    try {
      const userSubscriptions = this.userSubscriptions.get(data.userId);
      
      if (!userSubscriptions || userSubscriptions.length === 0) {
        console.log(`No web push subscriptions found for user ${data.userId}`);
        return {
          success: false,
          message: 'No active subscriptions found'
        };
      }

      const payload = JSON.stringify({
        title: data.title,
        body: data.message,
        icon: data.icon || '/favicon.ico',
        badge: data.badge || '/badge.png',
        image: data.image,
        data: {
          ...data.data,
          url: data.url || '/',
          notificationId: uuidv4(),
          userId: data.userId,
          type: data.type,
          timestamp: Date.now()
        },
        requireInteraction: data.requireInteraction || false,
        actions: data.actions || [],
        tag: `notification_${data.userId}_${Date.now()}`
      });

      const sendPromises = userSubscriptions.map(async (subscription, index) => {
        try {
          await webpush.sendNotification(subscription, payload);
          console.log(`Web push sent successfully to subscription ${index + 1} for user ${data.userId}`);
          return { success: true, subscription: subscription.endpoint };
        } catch (error) {
          console.error(`Failed to send web push to subscription ${index + 1}:`, error);
          
          // Remove invalid subscriptions
          if (error.statusCode === 410 || error.statusCode === 404) {
            console.log(`Removing invalid subscription for user ${data.userId}`);
            await this.unsubscribeUser(data.userId, subscription.endpoint);
          }
          
          return { success: false, subscription: subscription.endpoint, error: error.message };
        }
      });

      const results = await Promise.all(sendPromises);
      const successful = results.filter(result => result.success).length;

      // Store notification in database
      const db = this.fastify.db;
      await db.insert(notifications).values({
        id: uuidv4(),
        userId: data.userId,
        title: data.title,
        message: data.message,
        type: data.type,
        data: data.data ? JSON.stringify(data.data) : null,
      });

      console.log(`Web push notifications sent: ${successful}/${userSubscriptions.length} for user ${data.userId}`);

      return {
        success: successful > 0,
        totalSubscriptions: userSubscriptions.length,
        successfulDeliveries: successful,
        results
      };

    } catch (error) {
      console.error('Failed to send web push notification:', error);
      throw error;
    }
  }

  // Send web push to all admins
  async sendAdminWebPushNotification(data: Omit<WebPushNotificationData, 'userId'>) {
    try {
      const db = this.fastify.db;
      
      const adminUsers = await db.select({
        id: users.id,
        name: users.name,
        email: users.email
      })
      .from(users)
      .where(eq(users.role, 'admin'));

      const notifications = [];

      for (const admin of adminUsers) {
        notifications.push(
          this.sendWebPushNotification({
            ...data,
            userId: admin.id
          })
        );
      }

      const results = await Promise.allSettled(notifications);
      const successful = results.filter(r => r.status === 'fulfilled').length;

      console.log(`Admin web push notifications sent: ${successful}/${adminUsers.length}`);

      return {
        success: true,
        totalAdmins: adminUsers.length,
        notificationsSent: successful
      };

    } catch (error) {
      console.error('Failed to send admin web push notifications:', error);
      throw error;
    }
  }

  // Send web push to hotel vendors/staff
  async sendHotelVendorWebPushNotification(hotelId: string, data: Omit<WebPushNotificationData, 'userId'>) {
    try {
      const db = this.fastify.db;
      
      const hotelStaff = await db.select({
        id: users.id,
        name: users.name,
        email: users.email
      })
      .from(users)
      .where(and(
        eq(users.role, 'hotel_admin'),
        eq(users.isActive, true)
      ));

      const notifications = [];

      for (const staff of hotelStaff) {
        notifications.push(
          this.sendWebPushNotification({
            ...data,
            userId: staff.id,
            data: { ...data.data, hotelId }
          })
        );
      }

      const results = await Promise.allSettled(notifications);
      const successful = results.filter(r => r.status === 'fulfilled').length;

      console.log(`Hotel vendor web push notifications sent: ${successful}/${hotelStaff.length}`);

      return {
        success: true,
        totalStaff: hotelStaff.length,
        notificationsSent: successful
      };

    } catch (error) {
      console.error('Failed to send hotel vendor web push notifications:', error);
      throw error;
    }
  }

  // Send test web push notification
  async sendTestWebPushNotification(userId: string, message: string) {
    return this.sendWebPushNotification({
      userId,
      title: 'Test Notification',
      message,
      type: 'info',
      icon: '/favicon.ico',
      requireInteraction: true,
      actions: [
        {
          action: 'view',
          title: 'View Dashboard'
        },
        {
          action: 'dismiss',
          title: 'Dismiss'
        }
      ]
    });
  }

  // Get subscription count for user
  getSubscriptionCount(userId: string): number {
    return this.userSubscriptions.get(userId)?.length || 0;
  }

  // Get all users with active subscriptions
  getActiveUsers(): string[] {
    return Array.from(this.userSubscriptions.keys()).filter(
      userId => this.userSubscriptions.get(userId)!.length > 0
    );
  }
}
