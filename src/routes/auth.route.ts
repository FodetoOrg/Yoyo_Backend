import { FastifyInstance } from 'fastify';
import { AuthController } from '../controllers/auth.controller';
import { loginSchema, refreshTokenSchema } from '../schemas/auth.schema';

const authController = new AuthController();

export default async function authRoutes(fastify: FastifyInstance) {
  // Set fastify instance in the auth service
  authController['authService'].setFastify(fastify);

  
  // Public routes
  fastify.post('/login', {
    schema: {
      ...loginSchema,
      tags: ['auth'],
      summary: 'Login with Firebase ID token and get JWT tokens'
    }
  }, (request, reply) => authController.login(request, reply));

  fastify.post('/refresh-token', {
    schema: {
      ...refreshTokenSchema,
      tags: ['auth'],
      summary: 'Refresh access token using refresh token'
    }
  }, (request, reply) => authController.refreshToken(request, reply));

  // Protected routes (require authentication)
  fastify.get(
    '/profile',
    {
      schema: {
        tags: ['auth'],
        summary: 'Get user profile',
        security: [{ bearerAuth: [] }]
      },
      preHandler: [fastify.authenticate]
    },
    (request, reply) => authController.getProfile(request, reply)
  );

  fastify.put(
    '/profile',
    {
      schema: {
        tags: ['auth'],
        summary: 'Update user profile',
        security: [{ bearerAuth: [] }]
      },
      preHandler: [fastify.authenticate]
    },
    (request, reply) => authController.updateProfile(request, reply)
  );
}