// rbacGuard.js
// @ts-nocheck
import { eq } from "drizzle-orm";
import { users } from "../models/User";
import { HttpStatus } from "../types/common";
import { rolePermissions } from "../utils/rbac";
import { FastifyInstance } from "fastify";

export function rbacGuard(requiredPermission: string) {
  return async function (request: any, reply: any) {
    const userId = request.user?.id;
    const fastify = request.server as FastifyInstance;
    
    const user = await fastify.db.select().from(users).where(eq(users.id, userId)).get();

    if(!user){
      return reply
        .code(HttpStatus.UNAUTHORIZED)
        .send({ error: "Unauthorized: Invalid or expired token" });
    }

    const role = user?.role || "user";

    console.log("role in rbacGuard ", role);


    if (!role || !rolePermissions[role]?.[requiredPermission]) {
      return reply
        .code(HttpStatus.FORBIDDEN)
        .send({ error: "Forbidden: insufficient permissions" });
    }
  };
}
