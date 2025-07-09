import { FastifyInstance } from "fastify";
import { uploadToS3 } from "../config/aws";
import { v4 as uuidv4 } from "uuid";
import { NotFoundError } from "../types/errors";

interface UploadResult {
  id: string;
  url: string;
  filename: string;
  size: number;
  mimetype: string;
  uploadedAt: Date;
}

interface ImageProcessingOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
}

export class UploadService {
  private fastify!: FastifyInstance;

  setFastify(fastify: FastifyInstance) {
    this.fastify = fastify;
  }

  // Upload single image
  async uploadImage(
    fileBuffer: Buffer,
    filename: string,
    mimetype: string,
    options: ImageProcessingOptions = {}
  ): Promise<UploadResult> {
    try {
      // Validate file type
      if (!this.isValidImageType(mimetype)) {
        throw new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.');
      }

      // Validate file size (max 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (fileBuffer.length > maxSize) {
        throw new Error('File size too large. Maximum size is 10MB.');
      }

      // Process image if options are provided
      let processedBuffer = fileBuffer;
      let processedMimetype = mimetype;

      if (Object.keys(options).length > 0) {
        const processed = await this.processImage(fileBuffer, options);
        processedBuffer = processed.buffer;
        processedMimetype = processed.mimetype;
      }

      // Generate unique filename
      const fileExtension = this.getFileExtension(processedMimetype);
      const uniqueFilename = `${uuidv4()}-${filename.replace(/\.[^/.]+$/, "")}${fileExtension}`;

      // Upload to S3
      const url = await uploadToS3(processedBuffer, uniqueFilename, processedMimetype);

      return {
        id: uuidv4(),
        url,
        filename: uniqueFilename,
        size: processedBuffer.length,
        mimetype: processedMimetype,
        uploadedAt: new Date(),
      };
    } catch (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }
  }

  // Upload multiple images
  async uploadMultipleImages(
    files: Array<{
      buffer: Buffer;
      filename: string;
      mimetype: string;
    }>,
    options: ImageProcessingOptions = {}
  ): Promise<UploadResult[]> {
    const uploadPromises = files.map(file =>
      this.uploadImage(file.buffer, file.filename, file.mimetype, options)
    );

    return await Promise.all(uploadPromises);
  }

  // Convert base64 to buffer and upload
  async uploadBase64Image(
    base64Data: string,
    filename: string,
    options: ImageProcessingOptions = {}
  ): Promise<UploadResult> {
    try {
      // Extract mimetype and data from base64 string
      const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      
      if (!matches || matches.length !== 3) {
        throw new Error('Invalid base64 format');
      }

      const mimetype = matches[1];
      const base64Content = matches[2];
      const buffer = Buffer.from(base64Content, 'base64');

      return await this.uploadImage(buffer, filename, mimetype, options);
    } catch (error) {
      throw new Error(`Base64 upload failed: ${error.message}`);
    }
  }

  // Upload multiple base64 images
  async uploadMultipleBase64Images(
    base64Images: Array<{
      data: string;
      filename: string;
    }>,
    options: ImageProcessingOptions = {}
  ): Promise<UploadResult[]> {
    const uploadPromises = base64Images.map(image =>
      this.uploadBase64Image(image.data, image.filename, options)
    );

    return await Promise.all(uploadPromises);
  }

  // Delete image (placeholder - would need S3 delete implementation)
  async deleteImage(imageUrl: string): Promise<boolean> {
    try {
      // Extract key from S3 URL
      const urlParts = imageUrl.split('/');
      const key = urlParts.slice(-2).join('/'); // Get last two parts (folder/filename)

      // TODO: Implement S3 delete operation
      // await s3Client.send(new DeleteObjectCommand({
      //   Bucket: process.env.AWS_S3_BUCKET_NAME,
      //   Key: key
      // }));

      return true;
    } catch (error) {
      throw new Error(`Delete failed: ${error.message}`);
    }
  }

  // Process image (basic implementation - would need image processing library)
  private async processImage(
    buffer: Buffer,
    options: ImageProcessingOptions
  ): Promise<{ buffer: Buffer; mimetype: string }> {
    // This is a placeholder implementation
    // In a real application, you would use libraries like Sharp or Jimp
    // to resize, compress, and convert images
    
    let processedBuffer = buffer;
    let mimetype = 'image/jpeg'; // Default to JPEG

    // TODO: Implement actual image processing
    // - Resize based on maxWidth/maxHeight
    // - Compress based on quality
    // - Convert format if specified

    return {
      buffer: processedBuffer,
      mimetype,
    };
  }

  // Validate image type
  private isValidImageType(mimetype: string): boolean {
    const validTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
    ];
    return validTypes.includes(mimetype.toLowerCase());
  }

  // Get file extension from mimetype
  private getFileExtension(mimetype: string): string {
    const extensions: { [key: string]: string } = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
    };
    return extensions[mimetype.toLowerCase()] || '.jpg';
  }

  // Generate optimized image variants
  async generateImageVariants(
    originalBuffer: Buffer,
    filename: string,
    mimetype: string
  ): Promise<{
    original: UploadResult;
    thumbnail: UploadResult;
    medium: UploadResult;
  }> {
    const [original, thumbnail, medium] = await Promise.all([
      // Original
      this.uploadImage(originalBuffer, `original-${filename}`, mimetype),
      
      // Thumbnail (150x150)
      this.uploadImage(originalBuffer, `thumb-${filename}`, mimetype, {
        maxWidth: 150,
        maxHeight: 150,
        quality: 80,
      }),
      
      // Medium (800x600)
      this.uploadImage(originalBuffer, `medium-${filename}`, mimetype, {
        maxWidth: 800,
        maxHeight: 600,
        quality: 85,
      }),
    ]);

    return { original, thumbnail, medium };
  }
}