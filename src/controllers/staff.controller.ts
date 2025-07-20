// @ts-nocheck
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { StaffService } from '../services/staff.service';

interface AuthenticatedRequest extends FastifyRequest {
  user: {
    id: string;
    role: string;
  };
}

export class StaffController {
  private staffService: StaffService;
  private fastify: FastifyInstance | null = null;

  constructor(staffService: StaffService) {
    this.staffService = staffService;
  }

  setFastify(fastify: FastifyInstance) {
    this.fastify = fastify;
    this.staffService.setFastify(fastify);
  }

  // Create new staff member
  async createStaff(request: AuthenticatedRequest, reply: FastifyReply) {
    if (request.user.role !== 'admin') {
      return reply.status(403).send({ error: 'Only admin can create staff members' });
    }

    const data = request.body as {
      email: string;
      name?: string;
      phone?: string;
      department?: string;
      position?: string;
      permissions: Array<{ key: string; value: string }>;
      firebaseUid: string;
    };

    const staff = await this.staffService.createStaff(data);
    return reply.send({ success: true, data: staff });
  }

  // Get all staff members
  async getAllStaff(request: AuthenticatedRequest, reply: FastifyReply) {
    if (request.user.role !== 'admin' && request.user.role !== 'staff') {
      return reply.status(403).send({ error: 'Unauthorized' });
    }

    const staff = await this.staffService.getAllStaff();
    return reply.send({ success: true, data: staff });
  }

  // Update staff permissions
  async updateStaffPermissions(request: AuthenticatedRequest, reply: FastifyReply) {
    if (request.user.role !== 'admin') {
      return reply.status(403).send({ error: 'Only admin can update staff permissions' });
    }

    const { permissions } = request.body as {
      permissions: Array<{ key: string; value: string }>;
    };
    const staffId = (request.params as { id: string }).id;

    const updatedStaff = await this.staffService.updateStaffPermissions(staffId, permissions);
    return reply.send({ success: true, data: updatedStaff });
  }

  // Delete staff member
  async deleteStaff(request: AuthenticatedRequest, reply: FastifyReply) {
    if (request.user.role !== 'admin') {
      return reply.status(403).send({ error: 'Only admin can delete staff members' });
    }

    const staffId = (request.params as { id: string }).id;
    await this.staffService.deleteStaff(staffId);
    return reply.send({ success: true, message: 'Staff member deleted successfully' });
  }

  // Check staff permissions
  async checkPermission(request: AuthenticatedRequest, reply: FastifyReply) {
    const { permissionKey, permissionValue } = request.body as {
      permissionKey: string;
      permissionValue: string;
    };

    const hasPermission = await this.staffService.hasPermission(
      request.user.id,
      permissionKey,
      permissionValue
    );

    return reply.send({ success: true, data: { hasPermission } });
  }
} 