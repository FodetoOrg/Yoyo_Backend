//@ts-nocheck
import { FastifyRequest, FastifyReply } from 'fastify';
import { PartnerContactService } from '../services/partnerContact.service';
import { z } from 'zod';

const createPartnerContactSchema = z.object({
  hotelName: z.string().min(1),
  numberOfRooms: z.number().int().positive(),
  hotelDescription: z.string().optional(),
  ownerFullName: z.string().min(1),
  ownerEmail: z.string().email(),
  ownerPhone: z.string().min(10),
  address: z.string().min(1),
  city: z.string().min(1),
});

const updatePartnerContactSchema = z.object({
  status: z.enum(['pending', 'contacted', 'converted', 'rejected']).optional(),
  notes: z.string().optional(),
  contactedAt: z.string().datetime().optional(),
});

export class PartnerContactController {
  private partnerContactService: PartnerContactService;

  constructor() {
    this.partnerContactService = new PartnerContactService();
  }

  setFastify(fastify: any) {
    this.partnerContactService.setFastify(fastify);
  }

  async createPartnerContact(request: FastifyRequest, reply: FastifyReply) {
    try {
      const contactData = createPartnerContactSchema.parse(request.body);

      const result = await this.partnerContactService.createPartnerContact(contactData);

      return reply.code(201).send({
        success: true,
        message: 'Partner contact request submitted successfully',
        data: result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
      }

      return reply.code(500).send({
        success: false,
        message: error.message || 'Failed to create partner contact',
      });
    }
  }

  async getPartnerContacts(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { page = 1, limit = 10, status } = request.query as any;

      const result = await this.partnerContactService.getPartnerContacts(
        parseInt(page),
        parseInt(limit),
        status
      );

      return reply.code(200).send({
        success: true,
        data: result,
      });
    } catch (error) {
      return reply.code(500).send({
        success: false,
        message: 'Failed to fetch partner contacts',
      });
    }
  }

  async updatePartnerContact(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const updateData = updatePartnerContactSchema.parse(request.body);

      const processedData = {
        ...updateData,
        contactedAt: updateData.contactedAt ? new Date(updateData.contactedAt) : undefined,
      };

      const result = await this.partnerContactService.updatePartnerContact(id, processedData);

      return reply.code(200).send({
        success: true,
        message: 'Partner contact updated successfully',
        data: result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
      }

      return reply.code(500).send({
        success: false,
        message: error.message || 'Failed to update partner contact',
      });
    }
  }

  async getPartnerContactById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };

      const contact = await this.partnerContactService.getPartnerContactById(id);

      return reply.code(200).send({
        success: true,
        data: contact,
      });
    } catch (error) {
      return reply.code(404).send({
        success: false,
        message: error.message || 'Partner contact not found',
      });
    }
  }
}
