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
}
