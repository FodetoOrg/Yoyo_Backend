// @ts-nocheck
import { FastifyInstance } from 'fastify';
import { NotificationService } from '../services/notification.service';

export class NotificationProcessor {
  private fastify: FastifyInstance;
  private notificationService: NotificationService;
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(fastify: FastifyInstance) {
    this.fastify = fastify;
    this.notificationService = new NotificationService();
    this.notificationService.setFastify(fastify);
  }

  // Start the notification processor
  start(intervalMs: number = 30000) { // 30 seconds default
    if (this.isRunning) {
      console.log('Notification processor is already running');
      return;
    }

    this.isRunning = true;
    console.log('Starting notification processor...');

    this.intervalId = setInterval(async () => {
      try {
        const processed = await this.notificationService.processNotificationQueue(50);
        if (processed > 0) {
          console.log(`Processed ${processed} notifications`);
        }
      } catch (error) {
        console.error('Error in notification processor:', error);
      }
    }, intervalMs);

    // Process immediately on start
    setImmediate(async () => {
      try {
        const processed = await this.notificationService.processNotificationQueue(50);
        if (processed > 0) {
          console.log(`Initial processing: ${processed} notifications`);
        }
      } catch (error) {
        console.error('Error in initial notification processing:', error);
      }
    });
  }

  // Stop the notification processor
  stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    console.log('Notification processor stopped');
  }

  // Get processor status
  getStatus() {
    return {
      isRunning: this.isRunning,
      intervalId: this.intervalId !== null,
    };
  }
}

// Export singleton instance
let processorInstance: NotificationProcessor | null = null;

export function getNotificationProcessor(fastify: FastifyInstance): NotificationProcessor {
  if (!processorInstance) {
    processorInstance = new NotificationProcessor(fastify);
  }
  return processorInstance;
}