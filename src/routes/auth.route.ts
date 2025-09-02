import { FastifyInstance } from "fastify";
import { AuthController } from "../controllers/auth.controller";
import {
  addHotelAdminSchema,
  getAllUsersSchema,
  loginSchema,
  meSchema,
  profileSchema,
  refreshTokenSchema,
  updateProfileSchema,
} from "../schemas/auth.schema";
import { rbacGuard } from "../plugins/rbacGuard";
import { permissions } from "../utils/rbac";

const authController = new AuthController();

export default async function authRoutes(fastify: FastifyInstance) {
  authController["authService"].setFastify(fastify);

  fastify.post(
    "/login",
    {
      schema: loginSchema,
    },
    (request, reply) => authController.login(request, reply)
  );

  fastify.get(
    "/me",
    {
      schema: meSchema,
      preHandler: [fastify.authenticate],
    },
    (request, reply) => authController.verifyToken(request, reply)
  );

  fastify.post(
    "/refresh-token",
    {
      schema: refreshTokenSchema,
    },
    (request, reply) => authController.refreshToken(request, reply)
  );

  fastify.get(
    "/profile",
    {
      schema: profileSchema,
      preHandler: [
        fastify.authenticate,
        rbacGuard(permissions.viewUserProfile),
      ],
    },
    (request, reply) => authController.getProfile(request, reply)
  );

  fastify.put(
    "/profile",
    {
      // schema: updateProfileSchema,
      preHandler: [
        fastify.authenticate,
        rbacGuard(permissions.updateUserProfile),
      ],
    },
    (request, reply) => authController.updateProfile(request, reply)
  );

  fastify.get(
    "/users",
    {
      schema: getAllUsersSchema,
    },
    (request, reply) => authController.getAllUsers(request, reply)
  );

  fastify.post(
    "/addHotelAdmin",
    {
      schema: addHotelAdminSchema,
    },
    (request, reply) => authController.addHotelAdmin(request, reply)
  );

  // Update user status (admin only)
  fastify.patch(
    "/users/:userId/status",
    {
      schema: {
        tags: ["auth"],
        summary: "Update user status (admin only)",
        params: {
          type: "object",
          properties: {
            userId: { type: "string" }
          },
          required: ["userId"]
        },
        body: {
          type: "object",
          properties: {
            status: { 
              type: "string", 
              enum: ["active", "inactive"],
              description: "New status for the user"
            }
          },
          required: ["status"]
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
              data: {
                type: "object",
                properties: {
                  userId: { type: "string" },
                  status: { type: "string" },
                  updatedAt: { type: "string" }
                }
              }
            }
          }
        },
        security: [{ bearerAuth: [] }]
      },
      preHandler: [fastify.authenticate],
    },
    (request, reply) => authController.updateUserStatus(request, reply)
  );
}
