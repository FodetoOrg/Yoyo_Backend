import { createCitySchema, getAllCitiesSchema, getCityByIdSchema, updateCitySchema } from "../schemas/cities.schema";
import { CitiesController } from "../controllers/cities.controller";
import { FastifyInstance } from "fastify/fastify";




const citiesController = new CitiesController();

export default async function citiesRoutes(fastify: FastifyInstance) {
    citiesController.setFastify(fastify);

    fastify.get("/", {
        schema: {
            ...getAllCitiesSchema,
            tags: ["cities"],
            summary: "Get all cities",
        },
    }, (request, reply) => citiesController.getCities(request, reply));

    fastify.get("/:id", {
        schema: {
            ...getCityByIdSchema,
            tags: ["cities"],
            summary: "Get a city by id",
        },
    }, (request, reply) => citiesController.getCityById(request, reply));

    fastify.post("/", {
        schema: {
            ...createCitySchema,
            tags: ["cities"],
            summary: "Create a city",
        },
    }, (request, reply) => citiesController.createCity(request, reply));

    fastify.put("/:id", {
        schema: {
            ...updateCitySchema,
            tags: ["cities"],
            summary: "Update a city",
        },
    }, (request, reply) => citiesController.updateCity(request, reply));
    
    
}