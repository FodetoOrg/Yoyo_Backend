
// @ts-nocheck
import { FastifyInstance } from "fastify";
import { notifications, users, webPushSubscriptions, hotels } from "../models/schema";
import { eq, and, desc, or } from "drizzle-orm";
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
    // VAPID keys generated - set these in your environment variables:
    // VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY
    return vapidKeys;
  }

  // Get VAPID public key for client-side subscription
  getVapidPublicKey(): string {
    return process.env.VAPID_PUBLIC_KEY || webpush.generateVAPIDKeys().publicKey;
  }

  // Validate notification permissions (to be called on login/reload)
  async validateNotificationPermissions(userId: string) {
    try {
      const db = this.fastify.db;
      
      // Check if user has any active subscriptions
      const subscriptions = await db.select()
        .from(webPushSubscriptions)
        .where(and(
          eq(webPushSubscriptions.userId, userId),
          eq(webPushSubscriptions.isActive, true)
        ));

      // Get user details
      const user = await db.select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user.length) {
        return {
          success: false,
          error: 'User not found',
          requiresPermission: true
        };
      }

      // Check if user role requires notifications
      const requiresNotifications = ['superAdmin', 'hotel'].includes(user[0].role);

      return {
        success: true,
        hasSubscription: subscriptions.length > 0,
        requiresPermission: requiresNotifications && subscriptions.length === 0,
        subscriptionCount: subscriptions.length,
        userRole: user[0].role,
        message: requiresNotifications && subscriptions.length === 0 
          ? 'Notification permission required for your role' 
          : 'Notifications configured'
      };

    } catch (error) {
      console.error('Failed to validate notification permissions:', error);
      return {
        success: false,
        error: error.message,
        requiresPermission: false
      };
    }
  }

  // Check user's notification subscription status (one per user)
  async checkSubscriptionStatus(userId: string, endpoint?: string, p256dh?: string, auth?: string) {
    try {
      const db = this.fastify.db;
      
      // Get user's single active subscription
      const subscription = await db.select()
        .from(webPushSubscriptions)
        .where(and(
          eq(webPushSubscriptions.userId, userId),
          eq(webPushSubscriptions.isActive, true)
        ))
        .limit(1); // User should only have one

      if (!subscription.length) {
        return {
          isSubscribed: false,
          hasValidSubscription: false,
          needsUpdate: false,
          currentEndpoint: null
        };
      }

      const currentSub = subscription[0];

      // If endpoint and keys provided, check if they match current subscription
      if (endpoint && p256dh && auth) {
        const isMatching = currentSub.endpoint === endpoint && 
                          currentSub.p256dhKey === p256dh && 
                          currentSub.authKey === auth;

        return {
          isSubscribed: true,
          hasValidSubscription: isMatching,
          needsUpdate: !isMatching,
          currentEndpoint: currentSub.endpoint,
          providedEndpoint: endpoint,
          message: !isMatching ? 'Subscription details have changed, update required' : 'Subscription is valid'
        };
      }

      // Just return current subscription status
      return {
        isSubscribed: true,
        hasValidSubscription: true,
        needsUpdate: false,
        currentEndpoint: currentSub.endpoint
      };

    } catch (error) {
      console.error('Failed to check subscription status:', error);
      return {
        isSubscribed: false,
        hasValidSubscription: false,
        needsUpdate: false,
        currentEndpoint: null,
        error: error.message
      };
    }
  }

  // Subscribe user to web push notifications (ONE subscription per user)
  async subscribeUser(userId: string, subscription: WebPushSubscription) {
    try {
      const db = this.fastify.db;
      
      // Check if user has ANY existing subscription (only one allowed per user)
      const existing = await db.select()
        .from(webPushSubscriptions)
        .where(eq(webPushSubscriptions.userId, userId))
        .limit(1);

      if (existing.length > 0) {
        // User already has a subscription - UPDATE it with new endpoint/keys
        const needsUpdate = existing[0].endpoint !== subscription.endpoint ||
                          existing[0].p256dhKey !== subscription.keys.p256dh || 
                          existing[0].authKey !== subscription.keys.auth;
        
        if (needsUpdate) {
          // Update the existing subscription with new endpoint and keys
          await db.update(webPushSubscriptions)
            .set({
              endpoint: subscription.endpoint,  // Update endpoint too
              p256dhKey: subscription.keys.p256dh,
              authKey: subscription.keys.auth,
              isActive: true,
              updatedAt: new Date()
            })
            .where(eq(webPushSubscriptions.userId, userId));  // Update by userId
          
          return {
            success: true,
            message: 'Web push subscription updated with new endpoint/keys',
            action: 'updated',
            oldEndpoint: existing[0].endpoint,
            newEndpoint: subscription.endpoint
          };
        } else {
          // Everything is the same, just ensure it's active
          if (!existing[0].isActive) {
            await db.update(webPushSubscriptions)
              .set({
                isActive: true,
                updatedAt: new Date()
              })
              .where(eq(webPushSubscriptions.userId, userId));
            
            return {
              success: true,
              message: 'Subscription reactivated',
              action: 'reactivated'
            };
          }
          
          return {
            success: true,
            message: 'Subscription already exists and is active',
            action: 'existing'
          };
        }
      } else {
        // User has no subscription - CREATE new one
        await db.insert(webPushSubscriptions).values({
          id: uuidv4(),
          userId,
          endpoint: subscription.endpoint,
          p256dhKey: subscription.keys.p256dh,
          authKey: subscription.keys.auth,
          isActive: true
        });
        
        return {
          success: true,
          message: 'Successfully subscribed to web push notifications',
          action: 'created'
        };
      }


    } catch (error) {
      console.error('Failed to subscribe user:', error);
      throw error;
    }
  }

  // Unsubscribe user from web push notifications (they only have one)
  async unsubscribeUser(userId: string, endpoint?: string) {
    try {
      const db = this.fastify.db;
      
      // Since user can only have ONE subscription, we can just deactivate by userId
      // But if endpoint is provided, we can verify it matches
      if (endpoint) {
        await db.update(webPushSubscriptions)
          .set({ isActive: false, updatedAt: new Date() })
          .where(and(
            eq(webPushSubscriptions.userId, userId),
            eq(webPushSubscriptions.endpoint, endpoint)
          ));
      } else {
        // Just deactivate the user's single subscription
        await db.update(webPushSubscriptions)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(webPushSubscriptions.userId, userId));
      }
      
      return {
        success: true,
        message: 'Successfully unsubscribed from web push notifications'
      };

    } catch (error) {
      console.error('Failed to unsubscribe user:', error);
      throw error;
    }
  }

  // Get user subscriptions from database
  async getUserSubscriptions(userId: string) {
    const db = this.fastify.db;
    
    const subscriptions = await db.select()
      .from(webPushSubscriptions)
      .where(and(
        eq(webPushSubscriptions.userId, userId),
        eq(webPushSubscriptions.isActive, true)
      ));

    return subscriptions.map(sub => ({
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.p256dhKey,
        auth: sub.authKey
      }
    }));
  }

  // Send web push notification to specific user
  async sendWebPushNotification(data: WebPushNotificationData) {
    try {
      const userSubscriptions = await this.getUserSubscriptions(data.userId);
      
      if (!userSubscriptions || userSubscriptions.length === 0) {
        // Removed log(`No web push subscriptions found for user ${data.userId}`);
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
          // Removed log('payload is ',payload)
          await webpush.sendNotification(subscription, payload);
          // Removed log(`Web push sent successfully to subscription ${index + 1} for user ${data.userId}`);
          return { success: true, subscription: subscription.endpoint };
        } catch (error) {
          console.error(`Failed to send web push to subscription ${index + 1}:`, error);
          
          // Remove invalid subscriptions
          if (error.statusCode === 410 || error.statusCode === 404) {
            // Removed log(`Removing invalid subscription for user ${data.userId}`);
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

      // Removed log(`Web push notifications sent: ${successful}/${userSubscriptions.length} for user ${data.userId}`);

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

  // Send web push to all admins (both superAdmin and hotel admins)
  async sendAdminWebPushNotification(data: Omit<WebPushNotificationData, 'userId'>) {
    try {
      const db = this.fastify.db;
      
      // Get both super admins and hotel admins
      const adminUsers = await db.select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role
      })
      .from(users)
      .where(or(
        eq(users.role, 'superAdmin'),
        eq(users.role, 'hotel')  // Include hotel admins as well
      ));

      // Removed log(`Found ${adminUsers.length} admin users (superAdmin + hotel admins)`);

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

      // Removed log(`Admin web push notifications sent: ${successful}/${adminUsers.length}`);

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
      
      // First check if hotelId is valid
      if (!hotelId || hotelId === 'None' || hotelId === 'null' || hotelId === 'undefined') {
        // Removed log(`Invalid hotelId provided: ${hotelId}. Skipping hotel vendor notifications.`);
        return {
          success: false,
          totalStaff: 0,
          notificationsSent: 0,
          error: 'Invalid hotelId'
        };
      }
      
      // Get hotel owner and staff directly using ownerId from hotels table
      const hotelData = await db.select({
        ownerId: hotels.ownerId
      })
      .from(hotels)
      .where(eq(hotels.id, hotelId))
      .limit(1);
      
      if (!hotelData.length || !hotelData[0].ownerId) {
        // Removed log(`No hotel found with id ${hotelId} or no owner assigned`);
        return {
          success: false,
          totalStaff: 0,
          notificationsSent: 0
        };
      }
      
      // Check if ownerId is 'None' or other invalid values
      const invalidOwnerIds = ['None', 'none', 'null', 'undefined', '', null, undefined];
      if (invalidOwnerIds.includes(hotelData[0].ownerId)) {
        // Removed log(`Hotel ${hotelId} has invalid owner_id: "${hotelData[0].ownerId}". Skipping vendor notification.`);
        return {
          success: false,
          totalStaff: 0,
          notificationsSent: 0,
          error: `Invalid owner_id: ${hotelData[0].ownerId}`
        };
      }
      
      // Get the hotel owner (who should receive notifications)
      const hotelStaff = await db.select({
        id: users.id,
        name: users.name,
        email: users.email
      })
      .from(users)
      .where(and(
        eq(users.id, hotelData[0].ownerId),
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

      // Removed log(`Hotel vendor web push notifications sent: ${successful}/${hotelStaff.length}`);

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
  async getSubscriptionCount(userId: string): Promise<number> {
    const subscriptions = await this.getUserSubscriptions(userId);
    return subscriptions.length;
  }

  // Get all users with active subscriptions
  async getActiveUsers(): Promise<string[]> {
    const db = this.fastify.db;
    
    const activeSubscriptions = await db.select({ userId: webPushSubscriptions.userId })
      .from(webPushSubscriptions)
      .where(eq(webPushSubscriptions.isActive, true));

    return [...new Set(activeSubscriptions.map(sub => sub.userId))];
  }
}
