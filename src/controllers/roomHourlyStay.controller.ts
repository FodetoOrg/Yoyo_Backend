
import { FastifyRequest, FastifyReply } from 'fastify';
import { RoomHourlyStayService } from '../services/roomHourlyStay.service';
import { z } from 'zod';

const CreateHourlyStaySchema = z.object({
  roomId: z.string().uuid(),
  hours: z.number().int().min(1).max(24),
  price: z.number().min(0),
  name: z.string().min(1),
  description: z.string().optional(),
});

const UpdateHourlyStaySchema = z.object({
  hours: z.number().int().min(1).max(24).optional(),
  price: z.number().min(0).optional(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

export class RoomHourlyStayController {
  private roomHourlyStayService: RoomHourlyStayService;

  constructor() {
    this.roomHourlyStayService = new RoomHourlyStayService();
  }

  setFastify(fastify: any) {
    this.roomHourlyStayService.setFastify(fastify);
  }

  async createHourlyStay(request: FastifyRequest, reply: FastifyReply) {
    try {
      const data = CreateHourlyStaySchema.parse(request.body);
      const hourlyStay = await this.roomHourlyStayService.createHourlyStay(data);

      return reply.code(201).send({
        success: true,
        data: hourlyStay,
        message: 'Hourly stay created successfully',
      });
    } catch (error) {
      request.log.error(error);

      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
      }

      return reply.code(500).send({
        success: false,
        message: error.message || 'Failed to create hourly stay',
      });
    }
  }

  async getHourlyStaysByRoom(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { roomId } = request.params as { roomId: string };
      const hourlyStays = await this.roomHourlyStayService.getHourlyStaysByRoom(roomId);

      return reply.code(200).send({
        success: true,
        data: hourlyStays,
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        message: error.message || 'Failed to get hourly stays',
      });
    }
  }

  async getHourlyStaysByHotel(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { hotelId } = request.params as { hotelId: string };
      const hourlyStays = await this.roomHourlyStayService.getHourlyStaysByHotel(hotelId);

      return reply.code(200).send({
        success: true,
        data: hourlyStays,
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        message: error.message || 'Failed to get hourly stays',
      });
    }
  }

  async updateHourlyStay(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const data = UpdateHourlyStaySchema.parse(request.body);
      console.log('request.body ',request.body)
      const hourlyStay = await this.roomHourlyStayService.updateHourlyStay(id, data);
      console.log('hourlyStay ',hourlyStay)

      return reply.code(200).send({
        success: true,
        data: hourlyStay,
        message: 'Hourly stay updated successfully',
      });
    } catch (error) {
      request.log.error(error);

      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
      }

      return reply.code(500).send({
        success: false,
        message: error.message || 'Failed to update hourly stay',
      });
    }
  }

  async deleteHourlyStay(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      await this.roomHourlyStayService.deleteHourlyStay(id);

      return reply.code(200).send({
        success: true,
        message: 'Hourly stay deleted successfully',
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        message: error.message || 'Failed to delete hourly stay',
      });
    }
  }
}
