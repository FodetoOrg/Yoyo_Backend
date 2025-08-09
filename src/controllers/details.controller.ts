
// @ts-nocheck
import { FastifyRequest, FastifyReply } from 'fastify';
import { DetailsService } from '../services/details.service';

interface AuthenticatedRequest extends FastifyRequest {
  user: {
    id: string;
    phone: string;
    role: string;
    iat: number;
    exp: number;
  };
}

export class DetailsController {
  private detailsService: DetailsService;

  constructor() {
    this.detailsService = new DetailsService();
  }

  setFastify(fastify: any) {
    this.detailsService.setFastify(fastify);
  }

  async getRoomDetails(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { roomId } = request.params as { roomId: string };
      const userRole = request.user.role;

      // Check if user has permission to view room details
      if (!['admin', 'hotel_admin', 'superadmin'].includes(userRole)) {
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
      if (!['admin', 'hotel_admin', 'superadmin'].includes(userRole)) {
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
      if (!['admin', 'hotel_admin', 'superadmin'].includes(userRole)) {
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
      if (!['admin', 'superadmin'].includes(userRole)) {
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
}
