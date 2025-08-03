//@ts-nocheck
import { FastifyInstance } from "fastify";
import { roomHourlyStays, rooms } from "../models/schema";
import { eq, and, desc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

export class RoomHourlyStayService {
  private fastify!: FastifyInstance;

  setFastify(fastify: FastifyInstance) {
    this.fastify = fastify;
  }

  async createHourlyStay(data: {
    roomId: string;
    hours: number;
    price: number;
    name: string;
    description?: string;
  }) {
    const db = this.fastify.db;

    const newHourlyStay = {
      id: uuidv4(),
      roomId: data.roomId,
      hours: data.hours,
      price: data.price,
      name: data.name,
      description: data.description || null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.insert(roomHourlyStays).values(newHourlyStay);
    return newHourlyStay;
  }

  async getHourlyStaysByRoom(roomId: string) {
    const db = this.fastify.db;

    return db.query.roomHourlyStays.findMany({
      where: and(
        eq(roomHourlyStays.roomId, roomId),
        eq(roomHourlyStays.isActive, true)
      ),
      orderBy: [desc(roomHourlyStays.hours)],
    });
  }

  async getHourlyStaysByHotel(hotelId: string) {
    const db = this.fastify.db;

    return db
      .select({
        hourlyStay: roomHourlyStays,
        room: {
          id: rooms.id,
          name: rooms.name,
          roomNumber: rooms.roomNumber,
        }
      })
      .from(roomHourlyStays)
      .innerJoin(rooms, eq(roomHourlyStays.roomId, rooms.id))
      .where(and(
        eq(rooms.hotelId, hotelId),
        eq(roomHourlyStays.isActive, true)
      ))
      .orderBy([desc(roomHourlyStays.hours)]);
  }

  async updateHourlyStay(id: string, data: {
    hours?: number;
    price?: number;
    name?: string;
    description?: string;
    isActive?: boolean;
  }) {
    const db = this.fastify.db;

    await db
      .update(roomHourlyStays)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(roomHourlyStays.id, id));

    return this.getHourlyStayById(id);
  }

  async deleteHourlyStay(id: string) {
    const db = this.fastify.db;

    await db
      .update(roomHourlyStays)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(roomHourlyStays.id, id));
  }

  private async getHourlyStayById(id: string) {
    const db = this.fastify.db;

    return db.query.roomHourlyStays.findFirst({
      where: eq(roomHourlyStays.id, id),
    });
  }
}
