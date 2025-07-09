import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

// Base schemas
export const UploadResultSchema = z.object({
  id: z.string().uuid(),
  url: z.string().url(),
  filename: z.string(),
  size: z.number().int().positive(),
  mimetype: z.string(),
  uploadedAt: z.string().datetime(),
});

export const ImageProcessingOptionsSchema = z.object({
  maxWidth: z.number().int().positive().optional(),
  maxHeight: z.number().int().positive().optional(),
  quality: z.number().int().min(1).max(100).optional(),
  format: z.enum(['jpeg', 'png', 'webp']).optional(),
});

// Request schemas
export const UploadBase64RequestSchema = z.object({
  images: z.array(z.object({
    data: z.string().min(1),
    filename: z.string().min(1),
  })).min(1).max(10),
  options: ImageProcessingOptionsSchema.optional(),
});

export const DeleteImageRequestSchema = z.object({
  imageUrl: z.string().url(),
});

// Response schemas
export const UploadResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: UploadResultSchema,
});

export const MultipleUploadResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    images: z.array(UploadResultSchema),
    count: z.number().int().min(0),
  }),
});

export const ImageVariantsResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    original: UploadResultSchema,
    thumbnail: UploadResultSchema,
    medium: UploadResultSchema,
  }),
});

export const DeleteImageResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

// Fastify schema objects
export const uploadBase64ImagesSchema = {
  body: zodToJsonSchema(UploadBase64RequestSchema),
  response: {
    201: zodToJsonSchema(MultipleUploadResponseSchema),
    400: zodToJsonSchema(z.object({
      success: z.boolean(),
      message: z.string(),
      errors: z.array(z.any()).optional(),
    })),
  },
  tags: ['upload'],
  summary: 'Upload images from base64 data',
  description: 'Upload multiple images from base64 encoded data with optional processing',
};

export const uploadMultipartImageSchema = {
  consumes: ['multipart/form-data'],
  response: {
    201: zodToJsonSchema(UploadResponseSchema),
    400: zodToJsonSchema(z.object({
      success: z.boolean(),
      message: z.string(),
    })),
  },
  tags: ['upload'],
  summary: 'Upload single image from multipart form data',
  description: 'Upload a single image using multipart form data',
};

export const uploadMultipleMultipartImagesSchema = {
  consumes: ['multipart/form-data'],
  response: {
    201: zodToJsonSchema(MultipleUploadResponseSchema),
    400: zodToJsonSchema(z.object({
      success: z.boolean(),
      message: z.string(),
    })),
  },
  tags: ['upload'],
  summary: 'Upload multiple images from multipart form data',
  description: 'Upload multiple images using multipart form data',
};

export const generateImageVariantsSchema = {
  consumes: ['multipart/form-data'],
  response: {
    201: zodToJsonSchema(ImageVariantsResponseSchema),
    400: zodToJsonSchema(z.object({
      success: z.boolean(),
      message: z.string(),
    })),
  },
  tags: ['upload'],
  summary: 'Generate image variants',
  description: 'Generate multiple variants (original, thumbnail, medium) of an uploaded image',
};

export const deleteImageSchema = {
  body: zodToJsonSchema(DeleteImageRequestSchema),
  response: {
    200: zodToJsonSchema(DeleteImageResponseSchema),
    400: zodToJsonSchema(z.object({
      success: z.boolean(),
      message: z.string(),
    })),
  },
  tags: ['upload'],
  summary: 'Delete image from storage',
  description: 'Delete an uploaded image from cloud storage',
};