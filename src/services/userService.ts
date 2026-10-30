/**
 * User Service — business logic layer for user operations.
 *
 * Wraps the user repository and enforces any business rules around
 * user creation and retrieval.
 */

import { AppError } from '../utils/AppError';
import * as userRepo from '../repositories/userRepository';
import type { User, CreateUserResponse } from '../types';

// ─── Create User ──────────────────────────────────────────────────────────────

/**
 * Create a new user.
 *
 * @param name   Display name (required)
 * @param email  Email address (optional, unique)
 * @param id     Optional explicit UUID — useful for deterministic testing.
 *               Generated automatically if omitted.
 */
export async function createUser(
  name: string,
  email?: string,
  id?: string
): Promise<CreateUserResponse> {
  const user = await userRepo.createUser(name, email ?? null, id);
  return {
    success: true,
    userId:  user.id,
    message: 'User created successfully',
  };
}

// ─── Get User by ID ───────────────────────────────────────────────────────────

/**
 * Retrieve a user by their UUID.
 *
 * @throws AppError 404 if the user does not exist
 */
export async function getUserById(userId: string): Promise<User> {
  const user = await userRepo.getUserById(userId);
  if (!user) {
    throw AppError.notFound(`User ${userId}`);
  }
  return user;
}

// ─── User Exists ──────────────────────────────────────────────────────────────

/**
 * Check whether a user exists by ID.
 * Returns a plain boolean — does not throw.
 */
export async function userExists(userId: string): Promise<boolean> {
  return userRepo.userExists(userId);
}

