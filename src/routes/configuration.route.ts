// @ts-nocheck
import { FastifyInstance } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import {
  getAllConfigurations,
  getConfiguration,
  updateConfiguration,
  initializeConfigurations
} from '../controllers/configuration.controller';
import { configurations } from '../models/Configuration';
import { uploadToStorage } from '../config/firebase/firebase.ts';

async function configurationRoutes(fastify: FastifyInstance) {
  // Get all configurations (admin only)
  fastify.get('/configurations', {
    preHandler: [fastify.authenticate]
  }, getAllConfigurations);

  // Get specific configuration (admin only)
  fastify.get('/configurations/:key', {
    preHandler: [fastify.authenticate]
  }, getConfiguration);

  // Update configuration (admin only)
  fastify.put('/configurations/:key', {
    preHandler: [fastify.authenticate]
  }, updateConfiguration);

  // Initialize default configurations (admin only)
  fastify.post('/configurations/initialize', {
    preHandler: [fastify.authenticate]
  }, initializeConfigurations);

  fastify.get('/configurations/hotelIds', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const db = fastify.db;
      const hotelData = await db.query.hotels.findMany({
        columns: {
          id: true,
          name: true,
          city: true
        }
      });
      reply.send({
        success: true,
        data: hotelData,
        message: 'Configuration updated successfully'
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to initialize configurations';
      reply.code(500).send({
        success: false,
        message
      });
    }
  });

  fastify.post('/configurations/banner', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const db = fastify.db;
      const body = request.body as {
        banner_image?: string;
        coupon_code?: string;
      };

      console.log('body banner  ',body)

      let bannerImageUrl: string | null = null;
      const couponCode = body.coupon_code;
      const updates: string[] = [];

      // Handle base64 image upload
      if (body.banner_image) {
        if (body.banner_image.startsWith('data:image/')) {
          const buffer = Buffer.from(body.banner_image.split(',')[1], 'base64');
          const filename = `banner-${Date.now()}.jpg`;
          bannerImageUrl = await uploadToStorage(buffer, filename, 'image/jpeg');
        } else {
          return reply.code(400).send({
            success: false,
            message: 'Invalid base64 image format'
          });
        }
      }

      // Update configurations in database
      if (bannerImageUrl) {
        await db.insert(configurations).values({
          id:uuidv4(),
          key: 'app_banner_image',
          value: bannerImageUrl,
          type: 'string',
          description: 'Banner image URL for app',
          category: 'ui'
        }).onConflictDoUpdate({
          target: configurations.key,
          set: {
            value: bannerImageUrl,
            updatedAt: new Date()
          }
        });
        updates.push('banner image');
      }

      if (couponCode) {
        await db.insert(configurations).values({
          id:uuidv4(),
          key: 'app_banner_coupon_code',
          value: couponCode,
          type: 'string',
          description: 'Coupon code associated with banner',
          category: 'ui'
        }).onConflictDoUpdate({
          target: configurations.key,
          set: {
            value: couponCode,
            updatedAt: new Date()
          }
        });
        updates.push('coupon code');
      }

      if (updates.length === 0) {
        return reply.code(400).send({
          success: false,
          message: 'No banner image or coupon code provided'
        });
      }

      reply.send({
        success: true,
        data: {
          bannerImageUrl,
          couponCode,
          updates
        },
        message: `Successfully updated ${updates.join(' and ')}`
      });
    } catch (error: unknown) {
      console.log('Banner upload error:', error);
      const message = error instanceof Error ? error.message : 'Failed to upload banner';
      reply.code(500).send({
        success: false,
        message
      });
    }
  }); // <-- close fastify.post('/configurations/banner', ...)

} // <-- close configurationRoutes

export default configurationRoutes;
