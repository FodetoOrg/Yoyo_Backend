import { FastifyInstance } from 'fastify';
import { CustomerProfileController } from '../controllers/customerProfile.controller';

const customerProfileController = new CustomerProfileController();

export default async function customerProfileRoutes(fastify: FastifyInstance) {
  // Set fastify instance in the service
  customerProfileController.setFastify(fastify);

  // All profile routes require authentication
  fastify.addHook('onRequest', fastify.authenticate);

  // Get customer profile
  fastify.get('/', {
    schema: {
      tags: ['customer-profile'],
      summary: 'Get customer profile',
      description: 'Get the authenticated customer\'s profile information',
      security: [{ bearerAuth: [] }]
    }
  }, (request, reply) => customerProfileController.getProfile(request, reply));

  // Update customer profile
  fastify.put('/', {
    schema: {
      tags: ['customer-profile'],
      summary: 'Update customer profile',
      description: 'Update the authenticated customer\'s profile information',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          fullName: { type: 'string', minLength: 1 },
          email: { type: 'string', format: 'email' },
          gender: { 
            type: 'string', 
            enum: ['male', 'female', 'other', 'prefer_not_to_say'] 
          },
          dateOfBirth: { type: 'string', format: 'date-time' },
          profileImage: { type: 'string' },
          preferredLanguage: { type: 'string', default: 'en' },
          currency: { type: 'string', default: 'INR' }
        }
      }
    }
  }, (request, reply) => customerProfileController.updateProfile(request, reply));

  // Update notification preferences
  fastify.put('/notifications', {
    schema: {
      tags: ['customer-profile'],
      summary: 'Update notification preferences',
      description: 'Update the customer\'s notification preferences',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          bookingUpdates: { type: 'boolean' },
          checkinReminders: { type: 'boolean' },
          securityAlerts: { type: 'boolean' },
          promotionalOffers: { type: 'boolean' }
        }
      }
    }
  }, (request, reply) => customerProfileController.updateNotifications(request, reply));

  // Delete profile
  fastify.delete('/', {
    schema: {
      tags: ['customer-profile'],
      summary: 'Delete customer profile',
      description: 'Delete the authenticated customer\'s profile',
      security: [{ bearerAuth: [] }]
    }
  }, (request, reply) => customerProfileController.deleteProfile(request, reply));
}