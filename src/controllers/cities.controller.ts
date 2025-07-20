// @ts-nocheck
import { CitiesService } from "../services/cities.service";
import { FastifyBaseLogger, FastifyInstance, FastifyReply, FastifyRequest, FastifyTypeProviderDefault, RawServerDefault, RouteGenericInterface } from "fastify";
import { City } from "../models/cities";
import { ResolveFastifyRequestType } from "fastify/types/type-provider";
import { IncomingMessage, ServerResponse } from "http";



export class CitiesController {
 
    private citiesService: CitiesService;

    constructor() {
        this.citiesService = new CitiesService();
    }

    setFastify(fastify: FastifyInstance) {
        this.citiesService.setFastify(fastify);
    }

    async getCities(request: FastifyRequest, reply: FastifyReply) {
        const cities = await this.citiesService.getCities();
        return reply.code(200).send({
            success: true,
            data: cities,
        });
    }

    async getCityById(request: FastifyRequest, reply: FastifyReply) {
        const { id } = request.params as { id: string };
        const city = await this.citiesService.getCityById(id);
        return reply.code(200).send({
            success: true,
            data: city,
        });
    }

    async createCity(request: FastifyRequest, reply: FastifyReply) {
        const city = await this.citiesService.createCity(request.body as City);
        console.log(city);
        return reply.code(201).send({
            success: true,
            data: city,
        });
    }

    async updateCity(request: FastifyRequest, reply: FastifyReply) {
        const { id } = request.params as { id: string };
        const city = await this.citiesService.updateCity(id, request.body as City);
        return reply.code(200).send({
            success: true,
            data: city,
        });
    }
}