// @ts-nocheck
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

      console.log('addons are ',addons)

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

  // Add addons to room (append to existing)
  async addRoomAddons(
    request: FastifyRequest<{ Params: { hotelId: string; roomId: string }; Body: { addonIds: string[] } }>,
    reply: FastifyReply
  ) {
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


      const result = await this.addonService.addRoomAddons(hotelId, roomId, addonIds);
      

      return reply.code(200).send({
        success: true,
        message: 'Addons added to room successfully',
        data: result,
      });
    } catch (error) {
      return reply.code(400).send({
        success: false,
        message: error.message || 'Failed to add addons to room',
      });
    }
  }

  // Update room addons (replace all)
  async updateRoomAddons(
    request: FastifyRequest<{ Params: { hotelId: string; roomId: string }; Body: { addonIds: string[] } }>,
    reply: FastifyReply
  ) {
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
    } catch (error) {
      return reply.code(400).send({
        success: false,
        message: error.message || 'Failed to update room addons',
      });
    }
  }

  // Remove specific addon from room
  async removeRoomAddon(
    request: FastifyRequest<{ Params: { hotelId: string; roomId: string; addonId: string } }>,
    reply: FastifyReply
  ) {
    try {
      const { hotelId, roomId, addonId } = request.params;
      const user = (request as AuthenticatedRequest).user;

      // Check if user has permission to manage this hotel
      if (user.role === 'hotel' && user.hotelId !== hotelId) {
        return reply.code(403).send({
          success: false,
          message: 'You can only manage rooms for your own hotel',
        });
      }

      const result = await this.addonService.removeRoomAddon(hotelId, roomId, addonId);

      return reply.code(200).send({
        success: true,
        message: 'Addon removed from room successfully',
        data: result,
      });
    } catch (error) {
      return reply.code(400).send({
        success: false,
        message: error.message || 'Failed to remove addon from room',
      });
    }
  }

  // Get room addons
  async getRoomAddons(
    request: FastifyRequest<{ Params: { roomId: string } }>,
    reply: FastifyReply
  ) {
    try {
      const { roomId } = request.params;

      const roomAddons = await this.addonService.getRoomAddons(roomId);

      console.log('roomAddons ',roomAddons)

      return reply.code(200).send({
        success: true,
        message: 'Room addons retrieved successfully',
        data: roomAddons,
      });
    } catch (error) {
      return reply.code(400).send({
        success: false,
        message: error.message || 'Failed to retrieve room addons',
      });
    }
  }

  // Get available addons for room
  async getAvailableRoomAddons(
    request: FastifyRequest<{ Params: { hotelId: string; roomId: string } }>,
    reply: FastifyReply
  ) {
    try {
      const { hotelId, roomId } = request.params;
      const user = (request as AuthenticatedRequest).user;

      // Check if user has permission to manage this hotel
      if (user.role === 'hotel' && user.hotelId !== hotelId) {
        return reply.code(403).send({
          success: false,
          message: 'You can only manage rooms for your own hotel',
        });
      }

      const availableAddons = await this.addonService.getAvailableRoomAddons(hotelId, roomId);

      return reply.code(200).send({
        success: true,
        message: 'Available room addons retrieved successfully',
        data: availableAddons,
      });
    } catch (error) {
      return reply.code(400).send({
        success: false,
        message: error.message || 'Failed to retrieve available room addons',
      });
    }
  }
}