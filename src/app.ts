import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { config } from 'dotenv';

// Load environment variables
config();

// Import plugins
import registerSwagger from './plugins/swagger';
import registerJwt from './plugins/jwt';
import registerDb from './plugins/db';
import registerErrorHandler from './plugins/error-handler';

// Import routes
import authRoutes from './routes/auth.route';
import hotelRoutes from './routes/hotel.route';
import bookingRoutes from './routes/booking.route';
import  staffRoutes  from './routes/staff.route';
import citiesRoutes from './routes/cities.route';
import roomTypeRoutes from './routes/roomType.route';

// Create Fastify instance
export const app: FastifyInstance = fastify({
  logger: {
    level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
    transport: process.env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  },
  bodyLimit: 30 * 1024 * 1024, // 30MB limit for request body
});

// Register plugins
app.register(cors, {
  origin: true,
  credentials: true,
});

// Register custom plugins
app.register(registerSwagger);
app.register(registerJwt);
app.register(registerDb);
app.register(registerErrorHandler);

// Register routes
app.register(authRoutes, { prefix: '/api/v1/auth' });
app.register(hotelRoutes, { prefix: '/api/v1/hotels' });
app.register(bookingRoutes, { prefix: '/api/v1/bookings' });
app.register(staffRoutes, { prefix: '/api/v1/staff' });
app.register(citiesRoutes, { prefix: '/api/v1/cities' });
app.register(roomTypeRoutes, { prefix: '/api/v1/room-types' });

// Default route
app.get('/', async () => {
  return { message: 'Hotel Booking API' };
});

// Health check route
app.get('/health', async () => {
  return { status: 'ok' };
});

// 404 handler
app.setNotFoundHandler((request, reply) => {
  reply.code(404).send({ 
    error: 'Not Found',
    message: `Route ${request.method}:${request.url} not found`,
    statusCode: 404
  });
});

// Error handler
app.setErrorHandler((error, request, reply) => {
  app.log.error(error);
  
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal Server Error';
  
  reply.code(statusCode).send({ 
    error: statusCode >= 500 ? 'Internal Server Error' : error.name || 'Error',
    message,
    statusCode
  });
});