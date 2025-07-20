// @ts-nocheck
import fp from 'fastify-plugin';
import { FastifyInstance, FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { ErrorCode, HttpStatus } from '../types/common';
import { logger } from '../utils/logger';
import { AppError, ValidationError } from '../types/errors';

export default fp(async (fastify: FastifyInstance) => {
  fastify.setErrorHandler((error: FastifyError | AppError, request: FastifyRequest, reply: FastifyReply) => {
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
          details: error.errors.map(err => {
            const field = Array.isArray(err.path) ? err.path.join('.') : '';
            return {
              field,
              message: err.message
            };
          })
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
          details: error.validation.map(err => {
            const field = err.dataPath && err.dataPath.length > 0 ? err.dataPath.slice(1) : '';
            return {
              field,
              message: err.message
            };
          })
        }
      });
    }

    // Handle our custom AppError
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        success: false,
        message: error.message,
        error: {
          statusCode: error.statusCode,
          code: error.code,
          details: error.details
        }
      });
    }

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
  });
}); 