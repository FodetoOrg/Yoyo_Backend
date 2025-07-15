import { FastifyInstance } from 'fastify';
import { CustomerProfileController } from '../controllers/customerProfile.controller';
import {
  getProfileSchema,
  updateProfileSchema,
  updateNotificationsSchema,
  completeOnboardingSchema,
  skipOnboardingSchema,
  deleteProfileSchema
} from '../schemas/customerProfile.schema';

const customerProfileController = new CustomerProfileController();

export default async function customerProfileRoutes(fastify: FastifyInstance) {
  // Set fastify instance in the service
  customerProfileController.setFastify(fastify);

  // All profile routes require authentication
  fastify.addHook('onRequest', fastify.authenticate);

  // Get customer profile
  fastify.get('/', {
    schema: getProfileSchema,
    security: [{ bearerAuth: [] }]
  }, (request, reply) => customerProfileController.getProfile(request, reply));

  // Update customer profile
  fastify.put('/', {
    schema: updateProfileSchema,
    security: [{ bearerAuth: [] }]
  }, (request, reply) => customerProfileController.updateProfile(request, reply));

  // Update notification preferences
  fastify.put('/notifications', {
    schema: updateNotificationsSchema,
    security: [{ bearerAuth: [] }]
  }, (request, reply) => customerProfileController.updateNotifications(request, reply));

 // Complete onboarding
 fastify.post('/onboarding/complete', {

   schema: completeOnboardingSchema,
   security: [{ bearerAuth: [] }]

 }, (request, reply) => customerProfileController.completeOnboarding(request, reply));
 
 // Skip onboarding
 fastify.post('/onboarding/skip', {
   schema: skipOnboardingSchema,
   security: [{ bearerAuth: [] }]
 }, (request, reply) => customerProfileController.skipOnboarding(request, reply));
  // Delete profile
  fastify.delete('/', {
    schema: deleteProfileSchema,
    security: [{ bearerAuth: [] }]
  }, (request, reply) => customerProfileController.deleteProfile(request, reply));
}