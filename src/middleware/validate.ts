import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { AppError } from '../utils/AppError';

type ValidationTarget = 'body' | 'params' | 'query';

/**
 * Returns an Express middleware that validates a specific part of the request
 * (body, params, or query) against the provided Joi schema.
 *
 * On failure, it throws an AppError(400) with a human-readable message.
 */
export function validate(
  schema: Joi.ObjectSchema,
  target: ValidationTarget = 'body'
) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req[target], {
      abortEarly: false,   // collect all errors, not just the first
      stripUnknown: true,  // remove unknown keys from the validated value
      convert: true,       // coerce types (e.g. strings to numbers)
    });

    if (error) {
      const message = error.details.map((d) => d.message).join('; ');
      return next(AppError.badRequest(message, 'VALIDATION_ERROR'));
    }

    // Overwrite the request property with the validated (and stripped) value
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (req as any)[target] = value;
    next();
  };
}
