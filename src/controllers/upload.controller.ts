import { FastifyRequest, FastifyReply } from 'fastify';
import { UploadService } from '../services/upload.service';
import { z } from 'zod';

const uploadBase64Schema = z.object({
  images: z.array(z.object({
    data: z.string(),
    filename: z.string(),
  })),
  options: z.object({
    maxWidth: z.number().int().positive().optional(),
    maxHeight: z.number().int().positive().optional(),
    quality: z.number().int().min(1).max(100).optional(),
    format: z.enum(['jpeg', 'png', 'webp']).optional(),
  }).optional(),
});

const deleteImageSchema = z.object({
  imageUrl: z.string().url(),
});

export class UploadController {
  private uploadService: UploadService;

  constructor() {
    this.uploadService = new UploadService();
  }

  setFastify(fastify: any) {
    this.uploadService.setFastify(fastify);
  }

  // Upload images from base64
  async uploadBase64Images(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { images, options = {} } = uploadBase64Schema.parse(request.body);
      
      const results = await this.uploadService.uploadMultipleBase64Images(images, options);
      
      return reply.code(201).send({
        success: true,
        message: 'Images uploaded successfully',
        data: {
          images: results,
          count: results.length,
        },
      });
    } catch (error) {
      request.log.error(error);
      
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
      }
      
      return reply.code(500).send({
        success: false,
        message: error.message || 'Failed to upload images',
      });
    }
  }

  // Upload images from multipart form data
  async uploadMultipartImages(request: FastifyRequest, reply: FastifyReply) {
    try {
      const data = await request.file();
      
      if (!data) {
        return reply.code(400).send({
          success: false,
          message: 'No file provided',
        });
      }

      const buffer = await data.toBuffer();
      const result = await this.uploadService.uploadImage(
        buffer,
        data.filename,
        data.mimetype
      );
      
      return reply.code(201).send({
        success: true,
        message: 'Image uploaded successfully',
        data: result,
      });
    } catch (error) {
      request.log.error(error);
      
      return reply.code(500).send({
        success: false,
        message: error.message || 'Failed to upload image',
      });
    }
  }

  // Upload multiple images from multipart form data
  async uploadMultipleMultipartImages(request: FastifyRequest, reply: FastifyReply) {
    try {
      const files = request.files();
      const uploadPromises: Promise<any>[] = [];

      for await (const file of files) {
        const buffer = await file.toBuffer();
        uploadPromises.push(
          this.uploadService.uploadImage(buffer, file.filename, file.mimetype)
        );
      }

      const results = await Promise.all(uploadPromises);
      
      return reply.code(201).send({
        success: true,
        message: 'Images uploaded successfully',
        data: {
          images: results,
          count: results.length,
        },
      });
    } catch (error) {
      request.log.error(error);
      
      return reply.code(500).send({
        success: false,
        message: error.message || 'Failed to upload images',
      });
    }
  }

  // Delete image
  async deleteImage(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { imageUrl } = deleteImageSchema.parse(request.body);
      
      const success = await this.uploadService.deleteImage(imageUrl);
      
      if (success) {
        return reply.code(200).send({
          success: true,
          message: 'Image deleted successfully',
        });
      } else {
        return reply.code(500).send({
          success: false,
          message: 'Failed to delete image',
        });
      }
    } catch (error) {
      request.log.error(error);
      
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
      }
      
      return reply.code(500).send({
        success: false,
        message: error.message || 'Failed to delete image',
      });
    }
  }

  // Generate image variants
  async generateImageVariants(request: FastifyRequest, reply: FastifyReply) {
    try {
      const data = await request.file();
      
      if (!data) {
        return reply.code(400).send({
          success: false,
          message: 'No file provided',
        });
      }

      const buffer = await data.toBuffer();
      const variants = await this.uploadService.generateImageVariants(
        buffer,
        data.filename,
        data.mimetype
      );
      
      return reply.code(201).send({
        success: true,
        message: 'Image variants generated successfully',
        data: variants,
      });
    } catch (error) {
      request.log.error(error);
      
      return reply.code(500).send({
        success: false,
        message: error.message || 'Failed to generate image variants',
      });
    }
  }
}