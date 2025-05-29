import { FastifyInstance } from "fastify";
import { users } from "../models/User";
import { staff, staffPermissions } from "../models/Staff";
import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { Staff } from "../models/staff.model";
import { Permission } from "../models/permission.model";

export class StaffService {
  private fastify: FastifyInstance | null = null;

  constructor() {}

  setFastify(fastify: FastifyInstance) {
    this.fastify = fastify;
  }

  // Create a new staff member
  async createStaff(data: {
    email: string;
    name?: string;
    phone?: string;
    department?: string;
    position?: string;
    permissions: Array<{ key: string; value: string }>;
    firebaseUid: string;
  }): Promise<Staff> {
    if (!this.fastify) throw new Error("Fastify instance not set");

    const {
      email,
      name,
      phone,
      department,
      position,
      permissions,
      firebaseUid,
    } = data;

    // Create user first
    const user = await this.fastify.db.insert(users).values({
      email,
      name,
      phone,
      role: "staff",
      firebaseUid,
      id: uuidv4(),
    });

    // // Create staff record
    // const staff = await this.fastify.db.insert(staff).values({
    //   userId: user.id,
    //   department,
    //   position,
    //   permissions: {
    //     create: permissions.map((p) => ({
    //       permissionKey: p.key,
    //       permissionValue: p.value,
    //     })),
    //   },
    //   id: uuidv4(),
    //   include: {
    //     user: true,
    //     permissions: true,
    //   },
    // });

    // return staff;
    return user;
  }

  // Get all staff members with their permissions
  async getAllStaff(): Promise<Staff[]> {
    if (!this.fastify) throw new Error("Fastify instance not set");

    return this.fastify.prisma.staff.findMany({
      include: {
        user: true,
        permissions: true,
      },
    });
  }

  // Update staff member's permissions
  async updateStaffPermissions(
    staffId: string,
    permissions: Array<{ key: string; value: string }>
  ): Promise<Staff> {
    if (!this.fastify) throw new Error("Fastify instance not set");

    // Delete existing permissions
    await this.fastify.prisma.permission.deleteMany({
      where: { staffId },
    });

    // Create new permissions
    const staff = await this.fastify.prisma.staff.update({
      where: { id: staffId },
      data: {
        permissions: {
          create: permissions.map((p) => ({
            permissionKey: p.key,
            permissionValue: p.value,
          })),
        },
      },
      include: {
        user: true,
        permissions: true,
      },
    });

    return staff;
  }

  // Get staff member by ID with permissions
  async getStaffById(staffId: string) {
    const db = this.fastify.db;
    return await db.query.staff.findFirst({
      where: eq(staff.id, staffId),
      with: {
        user: true,
        permissions: true,
      },
    });
  }

  // Delete staff member
  async deleteStaff(staffId: string): Promise<void> {
    if (!this.fastify) throw new Error("Fastify instance not set");

    const staff = await this.fastify.prisma.staff.findUnique({
      where: { id: staffId },
      include: { user: true },
    });

    if (!staff) {
      throw new Error("Staff not found");
    }

    // Delete staff record and associated permissions
    await this.fastify.prisma.staff.delete({
      where: { id: staffId },
    });

    // Delete associated user
    await this.fastify.prisma.user.delete({
      where: { id: staff.userId },
    });
  }

  // Check if user has specific permission
  async hasPermission(
    userId: string,
    permissionKey: string,
    permissionValue: string
  ): Promise<boolean> {
    if (!this.fastify) throw new Error("Fastify instance not set");

    const staff = await this.fastify.prisma.staff.findFirst({
      where: { userId },
      include: { permissions: true },
    });

    if (!staff) return false;

    return staff.permissions.some(
      (p) =>
        p.permissionKey === permissionKey &&
        p.permissionValue === permissionValue
    );
  }
}
