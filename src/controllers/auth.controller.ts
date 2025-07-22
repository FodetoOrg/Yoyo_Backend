// @ts-nocheck
import fastify, { FastifyRequest, FastifyReply } from "fastify";
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
      const { idToken, role } = LoginRequestSchema.parse(request.body);

      const result = await this.authService.loginWithFirebase(idToken, role);

      const response = LoginResponseSchema.parse({
        success: true,
        data: result,
      });
      console.log("response is ", response);

      return reply.status(HttpStatus.OK).send(response);
    } catch (error) {
      logger.error({ error }, "Error during login");
      console.log('error ',error)
      throw error;
    }
  }

  async verifyToken(request: FastifyRequest, reply: FastifyReply) {
    try {
      const user = request.user
      console.log('user from request ', user)
      const userReturned = await this.authService.getUserById(user?.id)



      return reply.status(HttpStatus.OK).send({
        success: true,
        data: {

          user: userReturned
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

      const result = await this.authService.refreshToken(refreshToken);

      const response = RefreshTokenResponseSchema.parse({
        success: true,
        data: result,
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

  async updateProfile(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = (request as any).user.id;
      const userRole = (request as any).user.role;
      const updateData = request.body as any;

      const updatedProfile = await this.authService.updateProfile(userId, userRole, updateData);

      return reply.code(200).send({
        success: true,
        message: 'Profile updated successfully',
        data: updatedProfile,
      });
    } catch (error) {
      request.log.error(error);

      const statusCode = error.statusCode || 500;
      return reply.code(statusCode).send({
        success: false,
        message: error.message || 'Failed to update profile',
      });
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