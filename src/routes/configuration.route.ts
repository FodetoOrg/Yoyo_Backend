import { FastifyInstance } from 'fastify';
import {
  getAllConfigurations,
  getConfiguration,
  updateConfiguration,
  initializeConfigurations
} from '../controllers/configuration.controller';
import { rbacGuard } from '../plugins/rbacGuard';
import { UserRole } from '@/types/common';

async function configurationRoutes(fastify: FastifyInstance) {
  // Get all configurations (admin only)
  fastify.get('/configurations', {
    preHandler: [fastify.authenticate, ]
  }, getAllConfigurations);

  // Get specific configuration (admin only)
  fastify.get('/configurations/:key', {
    preHandler: [fastify.authenticate, ]
  }, getConfiguration);

  // Update configuration (admin only)
  fastify.put('/configurations/:key', {
    preHandler: [fastify.authenticate, ]
  }, updateConfiguration);

  // Initialize default configurations (admin only)
  fastify.post('/configurations/initialize', {
    preHandler: [fastify.authenticate, ]
  }, initializeConfigurations);

  fastify.get('/configurations/hotelIds', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {

      const db = fastify.db;

      const hotelData = await db.query.hotels.findMany({
        columns: {
          id: true,
          name: true,
          city: true
        }
      })
      reply.send({
        success: true,
        data: hotelData,
        message: 'Configuration updated successfully'
      });

    } catch (e) {
      reply.code(500).send({
        success: false,
        message: e.message || 'Failed to initialize configurations'
      });
    }


  });
}

export default configurationRoutes;
