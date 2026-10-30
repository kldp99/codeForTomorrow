/**
 * Custom application error class that carries an HTTP status code.
 * Throw this anywhere in the service/controller layer — the error handler
 * middleware will format it into a consistent JSON response.
 */
export class AppError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    status: number = 500,
    code: string = 'INTERNAL_ERROR',
    isOperational: boolean = true
  ) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.isOperational = isOperational;

    // Maintain proper stack trace (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  // ─── Common factory methods ───────────────────────────────────────────────

  static badRequest(message: string, code = 'BAD_REQUEST'): AppError {
    return new AppError(message, 400, code);
  }

  static unauthorized(message = 'Unauthorized', code = 'UNAUTHORIZED'): AppError {
    return new AppError(message, 401, code);
  }

  static forbidden(message = 'Forbidden', code = 'FORBIDDEN'): AppError {
    return new AppError(message, 403, code);
  }

  static notFound(resource: string, code = 'NOT_FOUND'): AppError {
    return new AppError(`${resource} not found`, 404, code);
  }

  static conflict(message: string, code = 'CONFLICT'): AppError {
    return new AppError(message, 409, code);
  }

  static internal(message = 'Internal server error', code = 'INTERNAL_ERROR'): AppError {
    return new AppError(message, 500, code, false);
  }
}
