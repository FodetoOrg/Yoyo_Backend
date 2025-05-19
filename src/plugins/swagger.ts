import fp from 'fastify-plugin';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import { FastifyInstance, FastifySchema } from 'fastify';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { z } from 'zod';

export default fp(async function (fastify: FastifyInstance) {
  await fastify.register(swagger, {
    openapi: {
      info: {
        title: 'Hotel Booking API Documentation',
        description: 'API documentation for the Hotel Booking application',
        version: '1.0.0',
      },
      externalDocs: {
        url: 'https://swagger.io',
        description: 'Find more info here',
      },
      servers: [
        {
          url: 'http://localhost:3000',
          description: 'Development server'
        }
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT'
          }
        }
      },
      tags: [
        { name: 'auth', description: 'Authentication endpoints' },
        { name: 'hotels', description: 'Hotel management endpoints' },
        { name: 'bookings', description: 'Booking management endpoints' }
      ]
    },
    hideUntagged: true,
    transform: ({ schema, url }) => {
      const baseSchema: FastifySchema = schema || {};

      // Helper function to check if something is a Zod schema
      const isZodSchema = (obj: any): obj is z.ZodType => {
        return obj && typeof obj === 'object' && typeof obj._def === 'object';
      };

      // Helper function to transform schema parts
      const transformSchemaPart = (part: any) => {
        if (!part) return undefined;
        if (isZodSchema(part)) {
          return zodToJsonSchema(part);
        }
        return part;
      };

      // Transform schema parts if they exist
      const transformedSchema: FastifySchema = {};

      if (baseSchema.tags) {
        transformedSchema.tags = baseSchema.tags;
      }

      if (baseSchema.summary) {
        transformedSchema.summary = baseSchema.summary;
      }

      if (baseSchema.description) {
        transformedSchema.description = baseSchema.description;
      }

      if (baseSchema.body) {
        transformedSchema.body = transformSchemaPart(baseSchema.body);
      }

      if (baseSchema.querystring) {
        transformedSchema.querystring = transformSchemaPart(baseSchema.querystring);
      }

      if (baseSchema.params) {
        transformedSchema.params = transformSchemaPart(baseSchema.params);
      }

      if (baseSchema.headers) {
        transformedSchema.headers = transformSchemaPart(baseSchema.headers);
      }

      if (baseSchema.response) {
        transformedSchema.response = Object.fromEntries(
          Object.entries(baseSchema.response).map(([code, respSchema]) => [
            code,
            transformSchemaPart(respSchema)
          ])
        );
      }

      // Add security requirement to all routes except auth
      if (!url.startsWith('/api/v1/auth')) {
        transformedSchema.security = [{ bearerAuth: [] }];
      }

      return { schema: transformedSchema, url };
    }
  });

  await fastify.register(swaggerUI, {
    routePrefix: '/documentation',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
    uiHooks: {
      onRequest: function (request, reply, next) {
        next();
      },
      preHandler: function (request, reply, next) {
        next();
      },
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
    transformSpecification: (swaggerObject) => {
      return swaggerObject;
    },
    transformSpecificationClone: true,
  });
});