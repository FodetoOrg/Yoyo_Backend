
import { FastifyInstance } from 'fastify';
import { PartnerContactController } from '../controllers/partnerContact.controller';

export async function partnerContactRoutes(fastify: FastifyInstance) {
  const partnerContactController = new PartnerContactController();
  partnerContactController.setFastify(fastify);

  // Create partner contact (public endpoint)
  fastify.post('/partner-contacts', {}, partnerContactController.createPartnerContact.bind(partnerContactController));

  // Get partner contacts (admin only)
  fastify.get('/partner-contacts', {
    onRequest: [fastify.authenticate, 
      // fastify.rbacGuard(['admin'])
    ],
  }, partnerContactController.getPartnerContacts.bind(partnerContactController));

  // Get partner contact by ID (admin only)
  fastify.get('/partner-contacts/:id', {
    onRequest: [fastify.authenticate, 
      // fastify.rbacGuard(['admin'])
    ],
  }, partnerContactController.getPartnerContactById.bind(partnerContactController));

  // Update partner contact (admin only)
  fastify.put('/partner-contacts/:id', {
    onRequest: [fastify.authenticate, 
      // fastify.rbacGuard(['admin'])
    ],
  }, partnerContactController.updatePartnerContact.bind(partnerContactController));
}
