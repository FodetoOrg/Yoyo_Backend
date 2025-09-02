// @ts-nocheck
import fastify, { FastifyRequest, FastifyReply } from "fastify";
import { AuthService } from "../services/auth.service";
import {
  LoginRequestSchema,
  RefreshTokenRequestSchema,
  LoginResponseSchema,
  RefreshTokenResponseSchema,
} from "../schemas/auth.schema";
import { HttpStatus, UserRole } from "../types/common";
import { logger } from "../utils/logger";
import { NotFoundError } from "../types/errors";

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

      // const response = LoginResponseSchema.parse({
      //   success: true,
      //   data: result,
      // });
      // console.log("response is ", response);

      return reply.status(HttpStatus.OK).send({
        success: true,
        data: result,
    });
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

  // Update user status (admin only)
  async updateUserStatus(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { userId } = request.params as { userId: string };
      const { status } = request.body as { status: 'active' | 'inactive' };
      const adminRole = (request as any).user.role;

      // Check if user is admin
      if (adminRole !== UserRole.SUPER_ADMIN) {
        return reply.code(403).send({
          success: false,
          message: 'Unauthorized. Only super admins can update user status',
        });
      }

      // Validate status
      if (status !== 'active' && status !== 'inactive') {
        return reply.code(400).send({
          success: false,
          message: 'Invalid status. Must be "active" or "inactive"',
        });
      }

      const updatedUser = await this.authService.updateUserStatus(userId, status);

      return reply.code(200).send({
        success: true,
        message: `User status updated to ${status} successfully`,
        data: {
          userId: updatedUser.id,
          status: updatedUser.status,
          updatedAt: updatedUser.updatedAt
        },
      });
    } catch (error) {
      request.log.error(error);

      if (error instanceof NotFoundError) {
        return reply.code(404).send({
          success: false,
          message: error.message || 'User not found',
        });
      }

      return reply.code(500).send({
        success: false,
        message: error.message || 'Failed to update user status',
      });
    }
  }
}