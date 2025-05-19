import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import { FastifyInstance, FastifyRequest } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest) => Promise<void>;
  }
  
  interface FastifyRequest {
    user: {
      id: string;
      phone: string;
      role: string;
      iat: number;
      exp: number;
    };
  }
}

export default fp(async function (fastify: FastifyInstance) {
  fastify.register(jwt, {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    sign: {
      expiresIn: '1h', // Access token expiration
    },
  });

  // Decorator to authenticate requests
  fastify.decorate('authenticate', async (request: FastifyRequest) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      const error = new Error('Unauthorized: Invalid or expired token');
      error['statusCode'] = 401;
      throw error;
    }
  });

  // Helper method to generate tokens
  fastify.decorateRequest('generateTokens', function(userId: string, phone: string, role: string = 'user') {
    const accessToken = fastify.jwt.sign({ 
      id: userId,
      phone, 
      role
    });

    const refreshToken = fastify.jwt.sign({ 
      id: userId,
      phone,
      role
    }, { 
      expiresIn: '7d' // Refresh token has a longer expiration
    });

    return { accessToken, refreshToken };
  });
});