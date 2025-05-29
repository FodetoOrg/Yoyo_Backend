import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { StaffController } from '../controllers/staff.controller';
import { StaffService } from '../services/staff.service';
import {
  createStaffSchema,
  getStaffSchema,
  updateStaffPermissionsSchema,
  deleteStaffSchema,
  checkPermissionSchema
} from '../schemas/staff.schema';

interface AuthenticatedRequest extends FastifyRequest {
  user: {
    id: string;
    role: string;
  };
}

const staffController = new StaffController(new StaffService());

export default async function staffRoutes(fastify: FastifyInstance) {
  // Set fastify instance in the staff service
  staffController.setFastify(fastify);

  // Create new staff member (admin only)
  fastify.post('/', {
    schema: {
      ...createStaffSchema,
      tags: ['staff'],
      summary: 'Create a new staff member',
      security: [{ bearerAuth: [] }]
    },
    preHandler: [fastify.authenticate]
  }, async (request: FastifyRequest, reply) => {
    return staffController.createStaff(request as AuthenticatedRequest, reply);
  });

  // Get all staff members (admin and staff only)
  fastify.get('/', {
    schema: {
      ...getStaffSchema,
      tags: ['staff'],
      summary: 'Get all staff members',
      security: [{ bearerAuth: [] }]
    },
    preHandler: [fastify.authenticate]
  }, async (request: FastifyRequest, reply) => {
    return staffController.getAllStaff(request as AuthenticatedRequest, reply);
  });

  // Update staff permissions (admin only)
  fastify.patch('/:id/permissions', {
    schema: {
      ...updateStaffPermissionsSchema,
      tags: ['staff'],
      summary: 'Update staff permissions',
      security: [{ bearerAuth: [] }]
    },
    preHandler: [fastify.authenticate]
  }, async (request: FastifyRequest, reply) => {
    return staffController.updateStaffPermissions(request as AuthenticatedRequest, reply);
  });

  // Delete staff member (admin only)
  fastify.delete('/:id', {
    schema: {
      ...deleteStaffSchema,
      tags: ['staff'],
      summary: 'Delete staff member',
      security: [{ bearerAuth: [] }]
    },
    preHandler: [fastify.authenticate]
  }, async (request: FastifyRequest, reply) => {
    return staffController.deleteStaff(request as AuthenticatedRequest, reply);
  });

  // Check staff permissions
  fastify.post('/check-permission', {
    schema: {
      ...checkPermissionSchema,
      tags: ['staff'],
      summary: 'Check staff permissions',
      security: [{ bearerAuth: [] }]
    },
    preHandler: [fastify.authenticate]
  }, async (request: FastifyRequest, reply) => {
    return staffController.checkPermission(request as AuthenticatedRequest, reply);
  });
} 