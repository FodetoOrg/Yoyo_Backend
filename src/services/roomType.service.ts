import { FastifyInstance } from "fastify";
import { roomTypes, RoomType } from "../models/schema";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { NotFoundError, ConflictError } from "../types/errors";

interface RoomTypeCreateParams {
  name: string;
  description?: string;
  status?: string;
}

export class RoomTypeService {
  private fastify!: FastifyInstance;

  setFastify(fastify: FastifyInstance) {
    this.fastify = fastify;
  }

  // Get all room types
  async getRoomTypes() {
    const db = this.fastify.db;
    return await db.query.roomTypes.findMany({
      orderBy: (roomTypes, { asc }) => [asc(roomTypes.name)]
    });
  }

  // Get room type by ID
  async getRoomTypeById(id: string) {
    const db = this.fastify.db;
    const roomType = await db.query.roomTypes.findFirst({
      where: eq(roomTypes.id, id)
    });

    if (!roomType) {
      throw new NotFoundError(`Room type with id ${id} not found`);
    }

    return roomType;
  }

  // Create room type
  async createRoomType(data: RoomTypeCreateParams) {
    const db = this.fastify.db;
    
    // Check if room type with same name exists
    const existing = await db.query.roomTypes.findFirst({
      where: eq(roomTypes.name, data.name)
    });

    if (existing) {
      throw new ConflictError(`Room type with name "${data.name}" already exists`);
    }

    const roomTypeId = uuidv4();
    
    await db.insert(roomTypes).values({
      id: roomTypeId,
      name: data.name,
      description: data.description,
      status: data.status || 'active',
    });

    return await this.getRoomTypeById(roomTypeId);
  }

  // Update room type
  async updateRoomType(id: string, data: Partial<RoomTypeCreateParams>) {
    const db = this.fastify.db;
    
    // Check if room type exists
    await this.getRoomTypeById(id);

    // Check if name is being changed and if it conflicts
    if (data.name) {
      const existing = await db.query.roomTypes.findFirst({
        where: eq(roomTypes.name, data.name)
      });

      if (existing && existing.id !== id) {
        throw new ConflictError(`Room type with name "${data.name}" already exists`);
      }
    }

    await db
      .update(roomTypes)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(roomTypes.id, id));

    return await this.getRoomTypeById(id);
  }

  // Delete room type
  async deleteRoomType(id: string) {
    const db = this.fastify.db;
    
    // Check if room type exists
    await this.getRoomTypeById(id);

    // Check if room type is being used by any rooms
    const roomsUsingType = await db.query.rooms.findMany({
      where: eq(rooms.roomTypeId, id)
    });

    if (roomsUsingType.length > 0) {
      throw new ConflictError(`Cannot delete room type. It is being used by ${roomsUsingType.length} room(s)`);
    }

    await db.delete(roomTypes).where(eq(roomTypes.id, id));
    return true;
  }
}