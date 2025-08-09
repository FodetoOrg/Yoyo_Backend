// @ts-nocheck
import { FastifyRequest, FastifyReply } from 'fastify';
import { DetailsService } from '../services/details.service';
import { UserRole } from '../types/common';

interface AuthenticatedRequest extends FastifyRequest {
  user: {
    id: string;
    phone: string;
    role: string;
    iat: number;
    exp: number;
  };
}

// Initialize detailsService outside the class to be accessible by controller functions
const detailsService = new DetailsService();

export class DetailsController {
  private detailsService: DetailsService;

  constructor() {
    this.detailsService = new DetailsService();
  }

  setFastify(fastify: any) {
    this.detailsService.setFastify(fastify);
    detailsService.setFastify(fastify); // Ensure the standalone service is also set
  }

  async getRoomDetails(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { roomId } = request.params as { roomId: string };
      const userRole = request.user.role;

      // Check if user has permission to view room details
      if (![UserRole.SUPER_ADMIN,UserRole.HOTEL_ADMIN].includes(userRole)) {
        return reply.code(403).send({
          success: false,
          message: 'Access denied. Insufficient permissions.'
        });
      }

      const roomDetails = await this.detailsService.getRoomDetails(roomId);

      return reply.code(200).send({
        success: true,
        data: roomDetails
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        message: error.message || 'Failed to fetch room details'
      });
    }
  }

  async getPaymentDetails(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { paymentId } = request.params as { paymentId: string };
      const userRole = request.user.role;

      // Check if user has permission to view payment details
      if (![UserRole.SUPER_ADMIN,UserRole.HOTEL_ADMIN].includes(userRole)) {
        return reply.code(403).send({
          success: false,
          message: 'Access denied. Insufficient permissions.'
        });
      }

      const paymentDetails = await this.detailsService.getPaymentDetails(paymentId);

      return reply.code(200).send({
        success: true,
        data: paymentDetails
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        message: error.message || 'Failed to fetch payment details'
      });
    }
  }

  async getRefundDetails(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { refundId } = request.params as { refundId: string };
      const userRole = request.user.role;

      // Check if user has permission to view refund details
      if (![UserRole.SUPER_ADMIN,UserRole.HOTEL_ADMIN].includes(userRole))  {
        return reply.code(403).send({
          success: false,
          message: 'Access denied. Insufficient permissions.'
        });
      }

      const refundDetails = await this.detailsService.getRefundDetails(refundId);

      return reply.code(200).send({
        success: true,
        data: refundDetails
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        message: error.message || 'Failed to fetch refund details'
      });
    }
  }

  async getHotelDetails(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { hotelId } = request.params as { hotelId: string };
      const userRole = request.user.role;

      // Check if user has admin permission
      if (![UserRole.SUPER_ADMIN].includes(userRole))  {
        return reply.code(403).send({
          success: false,
          message: 'Access denied. Admin permissions required.'
        });
      }

      const hotelDetails = await this.detailsService.getHotelDetails(hotelId);

      return reply.code(200).send({
        success: true,
        data: hotelDetails
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        message: error.message || 'Failed to fetch hotel details'
      });
    }
  }

  async getCustomerDetails(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { customerId } = request.params as { customerId: string };
      const userRole = request.user.role;

      // Check if user has permission to view customer details or is requesting their own details
      if (![UserRole.SUPER_ADMIN].includes(userRole)  && request.user.id !== customerId) {
        return reply.code(403).send({
          success: false,
          message: 'Access denied. Insufficient permissions.'
        });
      }

      const customerDetails = await this.detailsService.getCustomerDetails(customerId);

      return reply.code(200).send({
        success: true,
        data: customerDetails
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        message: error.message || 'Failed to fetch customer details'
      });
    }
  }

  async getAddonDetails(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { addonId } = request.params as { addonId: string };
      const userRole = request.user.role;

      // Check if user has permission to view addon details
      if (![UserRole.HOTEL_ADMIN,UserRole.SUPER_ADMIN].includes(userRole)) {
        return reply.code(403).send({
          success: false,
          message: 'Access denied. Insufficient permissions.'
        });
      }

      const addonDetails = await this.detailsService.getAddonDetails(addonId);
      console.log('addonDetails response ',addonDetails)

      return reply.code(200).send({
        success: true,
        data: addonDetails
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        message: error.message || 'Failed to fetch addon details'
      });
    }
  }
}

// Get all wallet usages (admin only)
export const getAllWalletUsages = async (request: FastifyRequest<{
  Querystring: { page?: number; limit?: number }
}>, reply: FastifyReply) => {
  try {
    detailsService.setFastify(request.server);

    const { page = 1, limit = 20 } = request.query;
    const result = await detailsService.getAllWalletUsages(Number(page), Number(limit));

    reply.send({
      success: true,
      data: result
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    reply.code(statusCode).send({
      success: false,
      message: error.message || 'Failed to fetch wallet usages'
    });
  }
};

// Get all refunds (admin only)
export const getAllRefunds = async (request: FastifyRequest<{
  Querystring: { page?: number; limit?: number }
}>, reply: FastifyReply) => {
  try {
    detailsService.setFastify(request.server);

    const { page = 1, limit = 20 } = request.query;
    const result = await detailsService.getAllRefunds(Number(page), Number(limit));

    reply.send({
      success: true,
      data: result
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    reply.code(statusCode).send({
      success: false,
      message: error.message || 'Failed to fetch refunds'
    });
  }
};

export const getWalletTransactionDetails = async (request: FastifyRequest<{