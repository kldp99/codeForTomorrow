import { In } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { AppDataSource } from '../database/data-source';
import { User } from '../entities';

export function getUserRepository() {
  return AppDataSource.getRepository(User);
}

/**
 * Create a new user using TypeORM repository (no raw SQL).
 */
export async function createUser(
  name: string,
  email: string | null = null,
  id?: string
): Promise<User> {
  const repo = getUserRepository();
  const user = repo.create({
    id: id ?? uuidv4(),
    name,
    email: email || null,
  });

  return await repo.save(user);
}

/**
 * Retrieve a user by ID using TypeORM repository (no raw SQL).
 */
export async function getUserById(id: string): Promise<User | null> {
  const repo = getUserRepository();
  return await repo.findOneBy({ id });
}

/**
 * Check whether a user exists using TypeORM repository (no raw SQL).
 */
export async function userExists(id: string): Promise<boolean> {
  const repo = getUserRepository();
  return await repo.existsBy({ id });
}

/**
 * Check whether multiple users exist in a single query using TypeORM In(...) operator.
 * Returns the list of IDs that were NOT found.
 */
export async function getMissingUserIds(ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];

  const repo = getUserRepository();
  const users = await repo.findBy({ id: In(ids) });
  const foundIds = new Set(users.map((u) => u.id));

  return ids.filter((id) => !foundIds.has(id));
}
