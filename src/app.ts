import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
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
import invoiceRoutes from './routes/invoice.route';
import couponRoutes from './routes/coupon.route';
import revenueRoutes from './routes/revenue.route';
import pricingRoutes from './routes/pricing.route';
import analyticsRoutes from './routes/analytics.route';
import uploadRoutes from './routes/upload.route';
import notificationRoutes from './routes/notification.route';
import paymentRoutes from './routes/payment.route';
import roomRoutes from './routes/room.route';
import hotelSearchRoutes from './routes/hotelSearch.route';
import customerProfileRoutes from './routes/customerProfile.route';
import wishlistRoutes from './routes/wishlist.route';
import { getNotificationProcessor } from './jobs/notification-processor';
import addonRoutes from "./routes/addon.route";
import hourlyStayRoutes from "./routes/roomHourlyStay.route";
import { partnerContactRoutes } from './routes/partnerContact.route';
import { refundRoutes } from './routes/refund.route';
import detailsRoutes from './routes/details.route'; // Assuming detailsRoutes is in './routes/details.route'
import { walletRoutes } from './routes/wallet.route';

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

// Register multipart for file uploads
app.register(multipart, {
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
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
app.register(invoiceRoutes, { prefix: '/api/v1/invoices' });
app.register(couponRoutes, { prefix: '/api/v1/coupons' });
app.register(revenueRoutes, { prefix: '/api/v1/revenue' });
app.register(pricingRoutes, { prefix: '/api/v1/pricing' });
app.register(analyticsRoutes, { prefix: '/api/v1/analytics' });
app.register(uploadRoutes, { prefix: '/api/v1/upload' });
app.register(notificationRoutes, { prefix: '/api/v1/notifications' });
app.register(paymentRoutes, { prefix: '/api/v1/payments' });
app.register(roomRoutes, { prefix: '/api/v1/rooms' });
app.register(hotelSearchRoutes, { prefix: '/api/v1/search' });
app.register(customerProfileRoutes, { prefix: '/api/v1/profile' });
app.register(wishlistRoutes, { prefix: '/api/v1/wishlist' });
app.register(addonRoutes, { prefix: '/api/v1/addons' });
app.register(hourlyStayRoutes, { prefix: '/api/v1/hourlyStays' });
app.register(partnerContactRoutes, { prefix: '/api/v1/partner-contacts' });

// Register refund routes
  await app.register(refundRoutes, { prefix: '/api/v1' });

  // Register details routes
  await app.register(detailsRoutes, { prefix: '/api/v1/details' });

// Register wallet routes
  await app.register(walletRoutes, { prefix: '/api/v1' });

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

// Start notification processor
app.addHook('onReady', async () => {
  const processor = getNotificationProcessor(app);
  // processor.start(30000); // Process every 30 seconds

  app.log.info('Notification processor started');
});

// Stop notification processor on close
app.addHook('onClose', async () => {
  const processor = getNotificationProcessor(app);
  processor.stop();

  app.log.info('Notification processor stopped');
});