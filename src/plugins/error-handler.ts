import fp from 'fastify-plugin';
import { FastifyInstance, FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { ErrorCode, HttpStatus } from '../types/common';
import { logger } from '../utils/logger';

export default fp(async (fastify: FastifyInstance) => {
  fastify.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    logger.error({
      err: error,
      requestId: request.id,
      url: request.url,
      method: request.method,
    }, 'Request error occurred');

    // Handle Zod validation errors
    if (error instanceof ZodError) {
      return reply.status(HttpStatus.BAD_REQUEST).send({
        success: false,
        message: 'Validation error',
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        }
      });
    }

    // Handle Fastify validation errors
    if (error.validation) {
      return reply.status(HttpStatus.BAD_REQUEST).send({
        success: false,
        message: 'Validation error',
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          details: error.validation.map(err => ({
            field: err.dataPath.slice(1), // Remove leading dot
            message: err.message
          }))
        }
      });
    }

    // Handle known error types
    switch (error.statusCode) {
      case HttpStatus.UNAUTHORIZED:
        return reply.status(HttpStatus.UNAUTHORIZED).send({
          success: false,
          message: error.message || 'Unauthorized',
          error: {
            code: ErrorCode.UNAUTHORIZED
          }
        });

      case HttpStatus.NOT_FOUND:
        return reply.status(HttpStatus.NOT_FOUND).send({
          success: false,
          message: error.message || 'Resource not found',
          error: {
            code: ErrorCode.NOT_FOUND
          }
        });

      case HttpStatus.CONFLICT:
        return reply.status(HttpStatus.CONFLICT).send({
          success: false,
          message: error.message || 'Resource conflict',
          error: {
            code: ErrorCode.CONFLICT
          }
        });

      default:
        // Handle unknown errors
        const statusCode = error.statusCode || HttpStatus.INTERNAL_SERVER_ERROR;
        return reply.status(statusCode).send({
          success: false,
          message: process.env.NODE_ENV === 'production' 
            ? 'Internal server error' 
            : error.message || 'Internal server error',
          error: {
            code: ErrorCode.INTERNAL_ERROR
          }
        });
    }
  });
}); 