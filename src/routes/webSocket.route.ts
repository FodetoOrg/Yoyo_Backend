// routes/websocket.routes.ts
import { FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';

import jwt from 'jsonwebtoken';
import { NotificationService } from '../services/notification.service';

const JWT_SECRET = process.env.JWT_SECRET || 'replace_me_with_real_secret';

function parseSubprotocolToken(req: any): string | undefined {
  // Expect: "jwt, <token>"
  const raw = (req.headers['sec-websocket-protocol'] || '')
    .split(',')
    .map((s: string) => s.trim())
    .filter(Boolean);
  const idx = raw.indexOf('jwt');
  return idx !== -1 ? raw[idx + 1] : undefined;
}

function parseQueryToken(req: any): string | undefined {
  try {
    const host = req.headers.host || 'localhost';
    const u = new URL(req.url, `http://${host}`);
    return u.searchParams.get('token') || undefined;
  } catch {
    return undefined;
  }
}

function extractToken(req: any): string | undefined {
  return (
    parseSubprotocolToken(req) ||
    parseQueryToken(req) ||
    (req.cookies && req.cookies.accessToken) ||
    undefined
  );
}

function verifyToken(token?: string) {
  if (!token) return null;
  try {
    // Payload should contain either sub/userId/id — adapt to your JWT schema
    const payload = jwt.verify(token, JWT_SECRET) as any;
    const userId = payload.sub || payload.userId || payload.id;
    return userId ? { userId, payload } : null;
  } catch {
    return null;
  }
}

export default async function webSocketRoutes(fastify: FastifyInstance) {
  const notificationService = new NotificationService();
  notificationService.setFastify(fastify);

  await fastify.register(websocket);   // IMPORTANT: use @fastify/websocket v8.x for Fastify v4

  fastify.get('/ws/notifications', { websocket: true }, (connection, req) => {
    const token = extractToken(req);
    const verified = verifyToken(token);

    if (!verified) {
      connection.socket.close(1008, 'Unauthorized'); // Policy Violation
      return;
    }

    const { userId } = verified;

    // Register client
    notificationService.registerWebClient(userId, connection.socket);

    // Send welcome
    connection.socket.send(JSON.stringify({
      type: 'connected',
      userId,
      message: 'Connected to notification service',
      timestamp: new Date().toISOString()
    }));

    connection.socket.on('message', async (message: Buffer) => {
      let data: any;
      try {
        data = JSON.parse(message.toString());
      } catch {
        connection.socket.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
        return;
      }

      switch (data.type) {
        case 'ping':
          connection.socket.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
          break;

        case 'identify':
          // Optional: update metadata if you want
          // notificationService.setClientMeta(userId, connection.socket, data);
          break;

        case 'mark_read':
          if (!data.notificationId) {
            connection.socket.send(JSON.stringify({ type: 'error', message: 'notificationId required' }));
            break;
          }
          try {
            await notificationService.markAsRead(userId, data.notificationId);
            connection.socket.send(JSON.stringify({
              type: 'notification_read',
              notificationId: data.notificationId,
              success: true
            }));
          } catch (e) {
            connection.socket.send(JSON.stringify({ type: 'error', message: 'Failed to mark as read' }));
          }
          break;

        default:
          connection.socket.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
      }
    });

    connection.socket.on('close', () => {
      // notificationService.unregisterWebClient(userId, connection.socket);
      fastify.log.info(`WS closed for user ${userId}`);
    });

    connection.socket.on('error', (err: Error) => {
      fastify.log.error({ err }, `WebSocket error for user ${userId}`);
    });
  });
}
