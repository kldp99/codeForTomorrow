import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';
import { isMySQLError, translateMySQLError } from '../utils/mysqlErrors';
import { config } from '../config/env';

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    status: number;
    details?: unknown;
  };
}

/**
 * Centralised Express error-handling middleware.
 * Must be registered LAST, after all routes.
 *
 * Handles:
 *  - AppError          — operational errors with known HTTP status
 *  - MySQL errors      — constraint violations, FK errors, etc.
 *  - Joi ValidationError — from request validation middleware
 *  - Generic Error     — unexpected programmer errors (logged, 500 returned)
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'An unexpected error occurred';
  let details: unknown;

  if (err instanceof AppError) {
    // ── Known operational error ──────────────────────────────────────────────
    status = err.status;
    code = err.code;
    message = err.message;

  } else if (isMySQLError(err)) {
    // ── MySQL driver error ───────────────────────────────────────────────────
    const appErr = translateMySQLError(err);
    if (appErr) {
      status = appErr.status;
      code = appErr.code;
      message = appErr.message;
    } else {
      // Unrecognised MySQL error — log it, return generic 500
      console.error('[ErrorHandler] Unhandled MySQL error:', err);
      code = 'DATABASE_ERROR';
      message = 'A database error occurred';
    }

  } else if (err.name === 'ValidationError') {
    // ── Joi validation error ─────────────────────────────────────────────────
    status = 400;
    code = 'VALIDATION_ERROR';
    message = err.message;

  } else if ((err as NodeJS.ErrnoException).code === 'ECONNREFUSED') {
    // ── Database connection refused ──────────────────────────────────────────
    status = 503;
    code = 'SERVICE_UNAVAILABLE';
    message = 'Database connection failed';

  } else {
    // ── Unexpected programmer error ──────────────────────────────────────────
    console.error('[ErrorHandler] Unhandled error:', err);
  }

  const body: ErrorResponse = {
    success: false,
    error: {
      code,
      message,
      status,
      ...(details !== undefined && { details }),
    },
  };

  res.status(status).json(body);
}

/**
 * 404 handler — register just before errorHandler.
 */
export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(AppError.notFound(`Route ${req.method} ${req.originalUrl}`));
}
