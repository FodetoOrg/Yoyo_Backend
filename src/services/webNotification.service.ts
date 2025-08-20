
// @ts-nocheck
import { FastifyInstance } from "fastify";
import { notifications, users } from "../models/schema";
import { eq, and, desc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

interface WebNotificationData {
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  data?: any;
  icon?: string;
  requireInteraction?: boolean;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
}

export class WebNotificationService {
  private fastify!: FastifyInstance;
  private connectedClients: Map<string, Set<any>> = new Map();

  setFastify(fastify: FastifyInstance) {
    this.fastify = fastify;
  }

  // Register client connection for real-time notifications
  registerClient(userId: string, socket: any) {
    if (!this.connectedClients.has(userId)) {
      this.connectedClients.set(userId, new Set());
    }
    this.connectedClients.get(userId)!.add(socket);

    socket.on('close', () => {
      const userSockets = this.connectedClients.get(userId);
      if (userSockets) {
        userSockets.delete(socket);
        if (userSockets.size === 0) {
          this.connectedClients.delete(userId);
        }
      }
    });

    console.log(`Client registered for user ${userId}. Total clients: ${this.connectedClients.get(userId)?.size}`);
  }

  // Send real-time web notification
  async sendRealTimeWebNotification(data: WebNotificationData) {
    try {
      const notification = {
        id: uuidv4(),
        ...data,
        timestamp: new Date(),
        read: false,
      };

      // Send to connected clients via WebSocket
      const userSockets = this.connectedClients.get(data.userId);
      if (userSockets && userSockets.size > 0) {
        const message = JSON.stringify({
          type: 'notification',
          data: notification
        });

        userSockets.forEach(socket => {
          try {
            if (socket.readyState === 1) { // WebSocket.OPEN
              socket.send(message);
            }
          } catch (error) {
            console.error('Error sending WebSocket message:', error);
          }
        });

        console.log(`Real-time notification sent to ${userSockets.size} clients for user ${data.userId}`);
      }

      // Store in database for persistence
      const db = this.fastify.db;
      await db.insert(notifications).values({
        id: notification.id,
        userId: data.userId,
        title: data.title,
        message: data.message,
        type: data.type,
        data: data.data ? JSON.stringify(data.data) : null,
      });

      return notification;

    } catch (error) {
      console.error('Failed to send real-time web notification:', error);
      throw error;
    }
  }

  // Send browser push notification
  async sendBrowserNotification(data: WebNotificationData) {
    try {
      // Send real-time notification first
      const notification = await this.sendRealTimeWebNotification(data);

      // Trigger browser notification via WebSocket
      const userSockets = this.connectedClients.get(data.userId);
      if (userSockets && userSockets.size > 0) {
        const browserNotification = {
          type: 'browser_notification',
          data: {
            title: data.title,
            body: data.message,
            icon: data.icon || '/favicon.ico',
            badge: '/badge.png',
            requireInteraction: data.requireInteraction || false,
            actions: data.actions || [],
            data: data.data || {},
            tag: `notification_${notification.id}`,
            timestamp: Date.now()
          }
        };

        const message = JSON.stringify(browserNotification);
        userSockets.forEach(socket => {
          try {
            if (socket.readyState === 1) {
              socket.send(message);
            }
          } catch (error) {
            console.error('Error sending browser notification:', error);
          }
        });
      }

      return notification;

    } catch (error) {
      console.error('Failed to send browser notification:', error);
      throw error;
    }
  }

  // Send notification to all admins
  async sendAdminNotification(data: Omit<WebNotificationData, 'userId'>) {
    try {
      const db = this.fastify.db;
      
      // Get all admin users
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
          this.sendBrowserNotification({
            ...data,
            userId: admin.id
          })
        );
      }

      const results = await Promise.allSettled(notifications);
      const successful = results.filter(r => r.status === 'fulfilled').length;

      console.log(`Admin notifications sent: ${successful}/${adminUsers.length}`);

      return {
        success: true,
        totalAdmins: adminUsers.length,
        notificationsSent: successful
      };

    } catch (error) {
      console.error('Failed to send admin notifications:', error);
      throw error;
    }
  }

  // Send notification to hotel vendors/staff
  async sendHotelVendorNotification(hotelId: string, data: Omit<WebNotificationData, 'userId'>) {
    try {
      const db = this.fastify.db;
      
      // Get hotel staff/vendors
      const hotelStaff = await db.select({
        id: users.id,
        name: users.name,
        email: users.email
      })
      .from(users)
      .where(and(
        eq(users.role, 'hotel_admin'),
        eq(users.isActive, true)
        // Add hotel association logic here if you have it in your schema
      ));

      const notifications = [];

      for (const staff of hotelStaff) {
        notifications.push(
          this.sendBrowserNotification({
            ...data,
            userId: staff.id,
            data: { ...data.data, hotelId }
          })
        );
      }

      const results = await Promise.allSettled(notifications);
      const successful = results.filter(r => r.status === 'fulfilled').length;

      console.log(`Hotel vendor notifications sent: ${successful}/${hotelStaff.length}`);

      return {
        success: true,
        totalStaff: hotelStaff.length,
        notificationsSent: successful
      };

    } catch (error) {
      console.error('Failed to send hotel vendor notifications:', error);
      throw error;
    }
  }

  // Get connected clients count
  getConnectedClientsCount(userId?: string): number {
    if (userId) {
      return this.connectedClients.get(userId)?.size || 0;
    }
    
    let total = 0;
    this.connectedClients.forEach(sockets => {
      total += sockets.size;
    });
    return total;
  }

  // Get all connected users
  getConnectedUsers(): string[] {
    return Array.from(this.connectedClients.keys());
  }

  // Disconnect user
  disconnectUser(userId: string) {
    const userSockets = this.connectedClients.get(userId);
    if (userSockets) {
      userSockets.forEach(socket => {
        try {
          socket.close();
        } catch (error) {
          console.error('Error closing socket:', error);
        }
      });
      this.connectedClients.delete(userId);
    }
  }

  // Send system announcement to all connected users
  async sendSystemAnnouncement(data: Omit<WebNotificationData, 'userId'>) {
    try {
      const connectedUsers = this.getConnectedUsers();
      const notifications = [];

      for (const userId of connectedUsers) {
        notifications.push(
          this.sendBrowserNotification({
            ...data,
            userId
          })
        );
      }

      const results = await Promise.allSettled(notifications);
      const successful = results.filter(r => r.status === 'fulfilled').length;

      console.log(`System announcement sent: ${successful}/${connectedUsers.length}`);

      return {
        success: true,
        totalUsers: connectedUsers.length,
        notificationsSent: successful
      };

    } catch (error) {
      console.error('Failed to send system announcement:', error);
      throw error;
    }
  }
}
