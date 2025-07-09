import { FastifyInstance } from "fastify";
import { v4 as uuidv4 } from "uuid";

interface NotificationData {
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  data?: any;
}

interface EmailNotificationData {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface SMSNotificationData {
  to: string;
  message: string;
}

export class NotificationService {
  private fastify!: FastifyInstance;
  private notifications: Map<string, any[]> = new Map(); // In-memory storage for demo

  setFastify(fastify: FastifyInstance) {
    this.fastify = fastify;
  }

  // Send real-time notification
  async sendRealTimeNotification(data: NotificationData) {
    try {
      const notification = {
        id: uuidv4(),
        ...data,
        timestamp: new Date(),
        read: false,
      };

      // Store notification
      const userNotifications = this.notifications.get(data.userId) || [];
      userNotifications.push(notification);
      this.notifications.set(data.userId, userNotifications);

      // TODO: Implement WebSocket/Server-Sent Events for real-time delivery
      // For now, we'll just log it
      console.log('Real-time notification sent:', notification);

      return notification;
    } catch (error) {
      throw new Error(`Failed to send real-time notification: ${error.message}`);
    }
  }

  // Send email notification
  async sendEmailNotification(data: EmailNotificationData) {
    try {
      // TODO: Implement actual email sending (using services like SendGrid, AWS SES, etc.)
      // For now, we'll just log it
      console.log('Email notification sent:', {
        to: data.to,
        subject: data.subject,
        timestamp: new Date(),
      });

      return {
        id: uuidv4(),
        to: data.to,
        subject: data.subject,
        status: 'sent',
        timestamp: new Date(),
      };
    } catch (error) {
      throw new Error(`Failed to send email notification: ${error.message}`);
    }
  }

  // Send SMS notification
  async sendSMSNotification(data: SMSNotificationData) {
    try {
      // TODO: Implement actual SMS sending (using services like Twilio, AWS SNS, etc.)
      // For now, we'll just log it
      console.log('SMS notification sent:', {
        to: data.to,
        message: data.message,
        timestamp: new Date(),
      });

      return {
        id: uuidv4(),
        to: data.to,
        message: data.message,
        status: 'sent',
        timestamp: new Date(),
      };
    } catch (error) {
      throw new Error(`Failed to send SMS notification: ${error.message}`);
    }
  }

  // Send push notification
  async sendPushNotification(data: NotificationData) {
    try {
      // TODO: Implement push notifications (using Firebase Cloud Messaging, etc.)
      // For now, we'll just log it
      console.log('Push notification sent:', {
        userId: data.userId,
        title: data.title,
        message: data.message,
        timestamp: new Date(),
      });

      return {
        id: uuidv4(),
        userId: data.userId,
        title: data.title,
        message: data.message,
        status: 'sent',
        timestamp: new Date(),
      };
    } catch (error) {
      throw new Error(`Failed to send push notification: ${error.message}`);
    }
  }

  // Get user notifications
  async getUserNotifications(userId: string, page: number = 1, limit: number = 10) {
    const userNotifications = this.notifications.get(userId) || [];
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    
    const paginatedNotifications = userNotifications
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(startIndex, endIndex);

    return {
      notifications: paginatedNotifications,
      total: userNotifications.length,
      page,
      limit,
      totalPages: Math.ceil(userNotifications.length / limit),
      unreadCount: userNotifications.filter(n => !n.read).length,
    };
  }

  // Mark notification as read
  async markAsRead(userId: string, notificationId: string) {
    const userNotifications = this.notifications.get(userId) || [];
    const notification = userNotifications.find(n => n.id === notificationId);
    
    if (notification) {
      notification.read = true;
      return notification;
    }
    
    throw new Error('Notification not found');
  }

  // Mark all notifications as read
  async markAllAsRead(userId: string) {
    const userNotifications = this.notifications.get(userId) || [];
    userNotifications.forEach(notification => {
      notification.read = true;
    });
    
    return {
      success: true,
      markedCount: userNotifications.length,
    };
  }

  // Delete notification
  async deleteNotification(userId: string, notificationId: string) {
    const userNotifications = this.notifications.get(userId) || [];
    const index = userNotifications.findIndex(n => n.id === notificationId);
    
    if (index !== -1) {
      userNotifications.splice(index, 1);
      this.notifications.set(userId, userNotifications);
      return true;
    }
    
    throw new Error('Notification not found');
  }

  // Send booking confirmation notification
  async sendBookingConfirmation(booking: any) {
    const notifications = [
      // Real-time notification
      this.sendRealTimeNotification({
        userId: booking.userId,
        title: 'Booking Confirmed',
        message: `Your booking at ${booking.hotel.name} has been confirmed for ${booking.checkInDate}`,
        type: 'success',
        data: { bookingId: booking.id },
      }),
      
      // Email notification
      this.sendEmailNotification({
        to: booking.user.email,
        subject: 'Booking Confirmation',
        html: `
          <h2>Booking Confirmed!</h2>
          <p>Dear ${booking.user.name},</p>
          <p>Your booking at <strong>${booking.hotel.name}</strong> has been confirmed.</p>
          <p><strong>Details:</strong></p>
          <ul>
            <li>Check-in: ${booking.checkInDate}</li>
            <li>Check-out: ${booking.checkOutDate}</li>
            <li>Room: ${booking.room.name}</li>
            <li>Total Amount: ₹${booking.totalAmount}</li>
          </ul>
          <p>Thank you for choosing our service!</p>
        `,
      }),
    ];

    await Promise.all(notifications);
  }

  // Send payment reminder
  async sendPaymentReminder(invoice: any) {
    const notifications = [
      // Real-time notification
      this.sendRealTimeNotification({
        userId: invoice.userId,
        title: 'Payment Reminder',
        message: `Payment of ₹${invoice.totalAmount} is due on ${invoice.dueDate}`,
        type: 'warning',
        data: { invoiceId: invoice.id },
      }),
      
      // Email notification
      this.sendEmailNotification({
        to: invoice.user.email,
        subject: 'Payment Reminder',
        html: `
          <h2>Payment Reminder</h2>
          <p>Dear ${invoice.user.name},</p>
          <p>This is a reminder that your payment of <strong>₹${invoice.totalAmount}</strong> is due on ${invoice.dueDate}.</p>
          <p>Please make the payment to avoid any inconvenience.</p>
          <p>Thank you!</p>
        `,
      }),
    ];

    await Promise.all(notifications);
  }

  // Send hotel admin notifications
  async sendHotelAdminNotification(hotelId: string, title: string, message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') {
    // TODO: Get hotel admin user ID from hotel
    // For now, we'll use a placeholder
    const hotelAdminUserId = 'hotel-admin-' + hotelId;
    
    return await this.sendRealTimeNotification({
      userId: hotelAdminUserId,
      title,
      message,
      type,
      data: { hotelId },
    });
  }
}