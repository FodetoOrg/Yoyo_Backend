import { FastifyRequest, FastifyReply } from "fastify";
import { AuthService } from "../services/auth.service";
import {
  LoginRequestSchema,
  RefreshTokenRequestSchema,
  LoginResponseSchema,
  RefreshTokenResponseSchema,
} from "../schemas/auth.schema";
import { HttpStatus } from "../types/common";
import { logger } from "../utils/logger";

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  setFastify(fastify: any) {
    this.authService.setFastify(fastify);
  }

  async login(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { idToken } = LoginRequestSchema.parse(request.body);

      const result = await this.authService.loginWithFirebase(idToken);

      const response = LoginResponseSchema.parse({
        success: true,
        data: result,
      });
      console.log("response is ", response);

      return reply.status(HttpStatus.OK).send(response);
    } catch (error) {
      logger.error({ error }, "Error during login");
      throw error;
    }
  }

  async verifyToken(request: FastifyRequest, reply: FastifyReply) {
    try {
      return reply.status(HttpStatus.OK).send({
        success: true,
        data: {
          message: "Token verified",
        },
      });
    } catch (error) {
      logger.error({ error }, "Error verifying token");
      throw error;
    }
  }

  async refreshToken(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { refreshToken } = RefreshTokenRequestSchema.parse(request.body);

      const tokens = await this.authService.refreshToken(refreshToken);

      const response = RefreshTokenResponseSchema.parse({
        success: true,
        data: tokens,
      });

      return reply.status(HttpStatus.OK).send(response);
    } catch (error) {
      logger.error(
        { error, refreshToken: request.body?.refreshToken },
        "Error refreshing token"
      );
      throw error;
    }
  }

  // Get user profile
  async getProfile(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = (request as any).user.id;
      const profile = await this.authService.getProfile(userId);

      return reply.status(HttpStatus.OK).send({
        success: true,
        data: { profile },
      });
    } catch (error) {
      logger.error(
        { error, userId: (request as any).user?.id },
        "Error getting profile"
      );
      throw error;
    }
  }

  // Update user profile
  async updateProfile(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = (request as any).user.id;
      const profile = await this.authService.updateProfile(
        userId,
        request.body
      );

      return reply.status(HttpStatus.OK).send({
        success: true,
        message: "Profile updated successfully",
        data: { profile },
      });
    } catch (error) {
      logger.error(
        {
          error,
          userId: (request as any).user?.id,
          body: request.body,
        },
        "Error updating profile"
      );
      throw error;
    }
  }

  async getAllUsers(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { page, limit, role } = request.query as {
        page: number;
        limit: number;
        role: string;
      };
      const users = await this.authService.getAllUsers(page, limit, role);
      return reply.status(HttpStatus.OK).send({
        success: true,
        data: {
          users,
          total: users.length,
          page,
          limit,
        },
      });
    } catch (error) {
      logger.error({ error }, "Error getting all users");
      throw error;
    }
  }

  async addHotelAdmin(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { name, phone, email } = request.body as {
        name: string;
        phone: string;
        email: string;
      };
      const hotelAdmin = await this.authService.addHotelAdmin(name, phone, email);
      return reply.status(HttpStatus.OK).send({
        success: true,
        data: { hotelAdmin },
      });
    } catch (error) {
      logger.error({ error }, "Error adding hotel admin");
      throw error;
    }
  }
}
