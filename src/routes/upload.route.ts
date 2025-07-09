import { FastifyInstance } from 'fastify';
import { UploadController } from '../controllers/upload.controller';
import {
  uploadBase64ImagesSchema,
  uploadMultipartImageSchema,
  uploadMultipleMultipartImagesSchema,
  generateImageVariantsSchema,
  deleteImageSchema,
} from '../schemas/upload.schema';

const uploadController = new UploadController();

export default async function uploadRoutes(fastify: FastifyInstance) {
  // Set fastify instance in the service
  uploadController.setFastify(fastify);

  // All upload routes require authentication
  fastify.addHook('onRequest', fastify.authenticate);

  // Upload images from base64
  fastify.post('/images/base64', {
    schema: {
      ...uploadBase64ImagesSchema,
      tags: ['upload'],
      summary: 'Upload images from base64 data',
      security: [{ bearerAuth: [] }]
    }
  }, (request, reply) => uploadController.uploadBase64Images(request, reply));

  // Upload single image from multipart form data
  fastify.post('/images/single', {
    schema: {
      ...uploadMultipartImageSchema,
      tags: ['upload'],
      summary: 'Upload single image from multipart form data',
      security: [{ bearerAuth: [] }]
    }
  }, (request, reply) => uploadController.uploadMultipartImages(request, reply));

  // Upload multiple images from multipart form data
  fastify.post('/images/multiple', {
    schema: {
      ...uploadMultipleMultipartImagesSchema,
      tags: ['upload'],
      summary: 'Upload multiple images from multipart form data',
      security: [{ bearerAuth: [] }]
    }
  }, (request, reply) => uploadController.uploadMultipleMultipartImages(request, reply));

  // Generate image variants (original, thumbnail, medium)
  fastify.post('/images/variants', {
    schema: {
      ...generateImageVariantsSchema,
      tags: ['upload'],
      summary: 'Generate image variants (original, thumbnail, medium)',
      security: [{ bearerAuth: [] }]
    }
  }, (request, reply) => uploadController.generateImageVariants(request, reply));

  // Delete image
  fastify.delete('/images', {
    schema: {
      ...deleteImageSchema,
      tags: ['upload'],
      summary: 'Delete image from storage',
      security: [{ bearerAuth: [] }]
    }
  }, (request, reply) => uploadController.deleteImage(request, reply));
}