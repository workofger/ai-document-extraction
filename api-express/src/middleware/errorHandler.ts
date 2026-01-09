import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { MulterError } from 'multer';

interface ApiError extends Error {
  statusCode?: number;
  code?: string;
}

/**
 * Not found handler for undefined routes
 */
export const notFoundHandler = (
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.path}`,
    code: 'NOT_FOUND',
    availableEndpoints: [
      'GET /api/health',
      'POST /api/documents/analyze',
      'POST /api/documents/validate-field'
    ]
  });
};

/**
 * Global error handler
 */
export const errorHandler = (
  err: ApiError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  console.error('Error:', err);

  // Zod validation errors
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: 'Validation error',
      code: 'VALIDATION_ERROR',
      details: err.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message
      }))
    });
    return;
  }

  // Multer file upload errors
  if (err instanceof MulterError) {
    let message = 'File upload error';
    let statusCode = 400;

    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        message = 'File too large. Maximum size is 100MB';
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'Too many files';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = 'Unexpected field name for file upload';
        break;
      default:
        message = err.message;
    }

    res.status(statusCode).json({
      success: false,
      error: message,
      code: `MULTER_${err.code}`
    });
    return;
  }

  // OpenAI API errors
  if (err.message?.includes('API') || err.message?.includes('OpenAI')) {
    res.status(502).json({
      success: false,
      error: 'AI service error. Please try again.',
      code: 'AI_SERVICE_ERROR'
    });
    return;
  }

  // Rate limit errors
  if (err.message?.includes('rate') || err.message?.includes('quota')) {
    res.status(429).json({
      success: false,
      error: 'Rate limit exceeded. Please wait before retrying.',
      code: 'RATE_LIMIT_EXCEEDED'
    });
    return;
  }

  // CORS errors
  if (err.message?.includes('CORS')) {
    res.status(403).json({
      success: false,
      error: 'Origin not allowed',
      code: 'CORS_ERROR'
    });
    return;
  }

  // Default error response
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message,
    code: err.code || 'INTERNAL_ERROR'
  });
};

