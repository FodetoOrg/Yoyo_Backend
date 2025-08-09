
// @ts-nocheck
import { FastifyInstance } from 'fastify';
import { 
  getAllConfigurations,
  getConfiguration,
  updateConfiguration,
  initializeConfigurations
} from '../controllers/configuration.controller';
import { rbacGuard } from '../plugins/rbacGuard';

async function configurationRoutes(fastify: FastifyInstance) {
  // Get all configurations (admin only)
  fastify.get('/configurations', {
    preHandler: [fastify.authenticate, rbacGuard(['superadmin'])]
  }, getAllConfigurations);

  // Get specific configuration (admin only)
  fastify.get('/configurations/:key', {
    preHandler: [fastify.authenticate, rbacGuard(['superadmin'])]
  }, getConfiguration);

  // Update configuration (admin only)
  fastify.put('/configurations/:key', {
    preHandler: [fastify.authenticate, rbacGuard(['superadmin'])]
  }, updateConfiguration);

  // Initialize default configurations (admin only)
  fastify.post('/configurations/initialize', {
    preHandler: [fastify.authenticate, rbacGuard(['superadmin'])]
  }, initializeConfigurations);
}

export default configurationRoutes;
