
import { FastifyRequest, FastifyReply } from 'fastify';
import { AddonService } from '../services/addon.service';
import { CreateAddonInput, UpdateAddonInput, GetAddonInput, UpdateRoomAddonsInput } from '../schemas/addon.schema';

export interface AuthenticatedRequest extends FastifyRequest {
  user: {
    id: string;
    role: string;
    hotelId?: string;
  };
}

export class AddonController {
  private addonService: AddonService;

  constructor(fastify: any) {
    this.addonService = new AddonService(fastify);
  }

  // Create addon
  async createAddon(request: FastifyRequest<CreateAddonInput>, reply: FastifyReply) {
    try {
      const { hotelId } = request.params;
      const addonData = request.body;
      const user = (request as AuthenticatedRequest).user;

      // Check if user has permission to manage this hotel
      if (user.role === 'hotel' && user.hotelId !== hotelId) {
        return reply.code(403).send({
          success: false,
          message: 'You can only manage addons for your own hotel',
        });
      }

      const addon = await this.addonService.createAddon(hotelId, addonData);

      return reply.code(201).send({
        success: true,
        message: 'Addon created successfully',
        data: { addon },
      });
    } catch (error: any) {
      return reply.code(500).send({
        success: false,
        message: error.message || 'Failed to create addon',
      });
    }
  }

  // Get hotel addons
  async getHotelAddons(request: FastifyRequest<GetAddonInput>, reply: FastifyReply) {
    try {
      const { hotelId } = request.params;

      const addons = await this.addonService.getHotelAddons(hotelId);

      return reply.code(200).send({
        success: true,
        data: { addons },
      });
    } catch (error: any) {
      return reply.code(500).send({
        success: false,
        message: error.message || 'Failed to fetch addons',
      });
    }
  }

  // Get single addon
  async getAddon(request: FastifyRequest<GetAddonInput>, reply: FastifyReply) {
    try {
      const { hotelId, addonId } = request.params;

      if (!addonId) {
        return reply.code(400).send({
          success: false,
          message: 'Addon ID is required',
        });
      }

      const addon = await this.addonService.getAddonById(hotelId, addonId);

      if (!addon) {
        return reply.code(404).send({
          success: false,
          message: 'Addon not found',
        });
      }

      return reply.code(200).send({
        success: true,
        data: { addon },
      });
    } catch (error: any) {
      return reply.code(500).send({
        success: false,
        message: error.message || 'Failed to fetch addon',
      });
    }
  }

  // Update addon
  async updateAddon(request: FastifyRequest<UpdateAddonInput>, reply: FastifyReply) {
    try {
      const { hotelId, addonId } = request.params;
      const updateData = request.body;
      const user = (request as AuthenticatedRequest).user;

      // Check if user has permission to manage this hotel
      if (user.role === 'hotel' && user.hotelId !== hotelId) {
        return reply.code(403).send({
          success: false,
          message: 'You can only manage addons for your own hotel',
        });
      }

      const addon = await this.addonService.updateAddon(hotelId, addonId, updateData);

      if (!addon) {
        return reply.code(404).send({
          success: false,
          message: 'Addon not found',
        });
      }

      return reply.code(200).send({
        success: true,
        message: 'Addon updated successfully',
        data: { addon },
      });
    } catch (error: any) {
      return reply.code(500).send({
        success: false,
        message: error.message || 'Failed to update addon',
      });
    }
  }

  // Delete addon
  async deleteAddon(request: FastifyRequest<GetAddonInput>, reply: FastifyReply) {
    try {
      const { hotelId, addonId } = request.params;
      const user = (request as AuthenticatedRequest).user;

      if (!addonId) {
        return reply.code(400).send({
          success: false,
          message: 'Addon ID is required',
        });
      }

      // Check if user has permission to manage this hotel
      if (user.role === 'hotel' && user.hotelId !== hotelId) {
        return reply.code(403).send({
          success: false,
          message: 'You can only manage addons for your own hotel',
        });
      }

      await this.addonService.deleteAddon(hotelId, addonId);

      return reply.code(200).send({
        success: true,
        message: 'Addon deleted successfully',
      });
    } catch (error: any) {
      return reply.code(500).send({
        success: false,
        message: error.message || 'Failed to delete addon',
      });
    }
  }

  // Update room addons
  async updateRoomAddons(request: FastifyRequest<UpdateRoomAddonsInput>, reply: FastifyReply) {
    try {
      const { hotelId, roomId } = request.params;
      const { addonIds } = request.body;
      const user = (request as AuthenticatedRequest).user;

      // Check if user has permission to manage this hotel
      if (user.role === 'hotel' && user.hotelId !== hotelId) {
        return reply.code(403).send({
          success: false,
          message: 'You can only manage rooms for your own hotel',
        });
      }

      const result = await this.addonService.updateRoomAddons(hotelId, roomId, addonIds);

      return reply.code(200).send({
        success: true,
        message: 'Room addons updated successfully',
        data: result,
      });
    } catch (error: any) {
      return reply.code(500).send({
        success: false,
        message: error.message || 'Failed to update room addons',
      });
    }
  }

  // Get room addons
  async getRoomAddons(request: FastifyRequest<{ Params: { roomId: string } }>, reply: FastifyReply) {
    try {
      const { roomId } = request.params;

      const roomAddons = await this.addonService.getRoomAddons(roomId);

      return reply.code(200).send({
        success: true,
        data: { addons: roomAddons.map(ra => ra.addon) },
      });
    } catch (error: any) {
      return reply.code(500).send({
        success: false,
        message: error.message || 'Failed to fetch room addons',
      });
    }
  }
}
