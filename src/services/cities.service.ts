import { hotelCities, hotels } from "../models/Hotel";
import { cities, City } from "../models/cities";
import { and, eq, sql } from "drizzle-orm";
import { FastifyInstance } from "fastify";
import { v4 as uuidv4 } from "uuid";
import { ConflictError, NotFoundError } from "../types/errors";

export class CitiesService {
  private fastify!: FastifyInstance;

  setFastify(fastify: FastifyInstance) {
    this.fastify = fastify;
  }

  async getCities() {
    const db = this.fastify.db;
    const allCities = await db
      .select({
        id: cities.id,
        name: cities.name,
        state: cities.state,
        numberOfHotels: sql<number>`COUNT(${hotels.id})`,
      })
      .from(cities)
      .leftJoin(hotelCities, eq(cities.id, hotelCities.cityId))
      .leftJoin(hotels, eq(hotelCities.hotelId, hotels.id))
      .groupBy(cities.id);
    return allCities;
  }

  async getCityById(id: string) {
    const db = this.fastify.db;
    const city = await db.query.cities.findFirst({
      where: eq(cities.id, id),
    });
    console.log('city from db is ',city)
    if (!city) {
      throw new NotFoundError(`City with id ${id} not found`);
    }
    return city;
  }

  async createCity(city: City) {
    const db = this.fastify.db;
    const existingCity = await db.query.cities.findFirst({
      where: and(eq(cities.name, city.name), eq(cities.state, city.state)),
    });
    if (existingCity) {
      throw new ConflictError(`City ${city.name} in ${city.state} already exists`);
    }
    const newCity = await db
      .insert(cities)
      .values({ ...city, id: uuidv4() })
      .returning();
    return newCity[0];
  }

  async updateCity(id: string, city: City) {
    const db = this.fastify.db;
    const existingCity = await db.query.cities.findFirst({
      where: eq(cities.id, id),
    });
    if (!existingCity) {
      throw new NotFoundError(`City with id ${id} not found`);
    }
    const updatedCity = await db
      .update(cities)
      .set(city)
      .where(eq(cities.id, id))
      .returning();
    return updatedCity[0];
  }
}
