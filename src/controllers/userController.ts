/**
 * User Controller — HTTP layer for user endpoints.
 *
 * Responsibilities:
 *  - Extract and pass validated input to the service layer
 *  - Map service results to HTTP responses with correct status codes
 *  - Delegate all errors to Express error handler via next(err)
 *
 * No raw SQL, no business logic here.
 */

import { Request, Response, NextFunction } from 'express';
import * as userService from '../services/userService';
import type { CreateUserRequest } from '../types';

// ─── POST /api/v1/user ────────────────────────────────────────────────────────

/**
 * Create a new user.
 * Returns 201 with the generated userId.
 */
export async function createUser(
  req: Request<Record<string, never>, unknown, CreateUserRequest>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { name, email, id } = req.body;
    const result = await userService.createUser(name, email, id);

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/v1/user/:userId ────────────────────────────────────────────────

/**
 * Retrieve a user by their UUID.
 */
export async function getUserById(
  req: Request<{ userId: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { userId } = req.params;
    const user = await userService.getUserById(userId);

    res.status(200).json({
      success: true,
      user: {
        id:        user.id,
        name:      user.name,
        email:     user.email,
        createdAt: user.created_at.toISOString(),
        updatedAt: user.updated_at.toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
}

