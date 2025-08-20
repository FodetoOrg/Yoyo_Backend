
// @ts-nocheck
import { FastifyInstance } from 'fastify';
import { NotificationService } from '../services/notification.service';

export default async function webSocketRoutes(fastify: FastifyInstance) {
  const notificationService = new NotificationService();
  notificationService.setFastify(fastify);

  // WebSocket route for real-time notifications
  fastify.register(async function (fastify) {
    await fastify.register(require('@fastify/websocket'));

    fastify.get('/ws/notifications', { websocket: true }, (connection, req) => {
      const userId = (req as any).user?.id;
      
      if (!userId) {
        connection.socket.close(1008, 'Unauthorized');
        return;
      }

      // Register client for notifications
      notificationService.registerWebClient(userId, connection.socket);

      // Send welcome message
      connection.socket.send(JSON.stringify({
        type: 'connected',
        message: 'Connected to notification service',
        userId: userId,
        timestamp: new Date()
      }));

      // Handle incoming messages
      connection.socket.on('message', async (message) => {
        try {
          const data = JSON.parse(message.toString());
          
          switch (data.type) {
            case 'ping':
              connection.socket.send(JSON.stringify({
                type: 'pong',
                timestamp: new Date()
              }));
              break;
              
            case 'mark_read':
              if (data.notificationId) {
                try {
                  await notificationService.markAsRead(userId, data.notificationId);
                  connection.socket.send(JSON.stringify({
                    type: 'notification_read',
                    notificationId: data.notificationId,
                    success: true
                  }));
                } catch (error) {
                  connection.socket.send(JSON.stringify({
                    type: 'error',
                    message: 'Failed to mark notification as read'
                  }));
                }
              }
              break;
              
            default:
              connection.socket.send(JSON.stringify({
                type: 'error',
                message: 'Unknown message type'
              }));
          }
        } catch (error) {
          connection.socket.send(JSON.stringify({
            type: 'error',
            message: 'Invalid message format'
          }));
        }
      });

      connection.socket.on('close', () => {
        console.log(`User ${userId} disconnected from notification service`);
      });

      connection.socket.on('error', (error) => {
        console.error(`WebSocket error for user ${userId}:`, error);
      });
    });
  });
}
