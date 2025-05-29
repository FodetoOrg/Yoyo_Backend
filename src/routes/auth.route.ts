import { FastifyInstance } from "fastify";
import { AuthController } from "../controllers/auth.controller";
import {
  addHotelAdminSchema,
  getAllUsersSchema,
  loginSchema,
  refreshTokenSchema,
} from "../schemas/auth.schema";
import { rbacGuard } from "../plugins/rbacGuard";
import { permissions } from "../utils/rbac";

const authController = new AuthController();

export default async function authRoutes(fastify: FastifyInstance) {
  // Set fastify instance in the auth service
  authController["authService"].setFastify(fastify);

  // Public routes
  fastify.post(
    "/login",
    {
      schema: {
        ...loginSchema,
        tags: ["auth"],
        summary: "Login with Firebase ID token and get JWT tokens",
      },
    },
    (request, reply) => authController.login(request, reply)
  );

  fastify.get(
    "/me",
    {
      schema: {
        tags: ["auth"],
        summary: "Get user profile",
        security: [{ bearerAuth: [] }],
      },
      preHandler: [fastify.authenticate],
    },
    (request, reply) => authController.verifyToken(request, reply)
  );

  fastify.post(
    "/refresh-token",
    {
      schema: {
        ...refreshTokenSchema,
        tags: ["auth"],
        summary: "Refresh access token using refresh token",
      },
    },
    (request, reply) => authController.refreshToken(request, reply)
  );

  // Protected routes (require authentication)
  fastify.get(
    "/profile",
    {
      schema: {
        tags: ["auth"],
        summary: "Get user profile",
        security: [{ bearerAuth: [] }],
      },
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
      schema: {
        tags: ["auth"],
        summary: "Update user profile",
        security: [{ bearerAuth: [] }],
      },
      preHandler: [
        fastify.authenticate,
        rbacGuard(permissions.updateUserProfile),
      ],
    },
    (request, reply) => authController.updateProfile(request, reply)
  );

  // paginated response  userRole , and paginated response
  fastify.get(
    "/users",
    {
      schema: {
        ...getAllUsersSchema,
        tags: ["auth"],
        summary: "Get all users with pagination",
        security: [{ bearerAuth: [] }],
      },
      // preHandler: [fastify.authenticate],
    },
    (request, reply) => authController.getAllUsers(request, reply)
  );

  fastify.post(
    "/addHotelAdmin",
    {
      schema: {
        ...addHotelAdminSchema,
        tags: ["auth"],
        summary: "Add hotel admin",
      },
    },
    (request, reply) => authController.addHotelAdmin(request, reply)
  );
}
