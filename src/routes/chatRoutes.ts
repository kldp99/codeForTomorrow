/**
 * API Routes — Phase 1 (MySQL only)
 *
 * User routes:
 *   POST   /api/v1/user              — create a user
 *   GET    /api/v1/user/:userId      — get a user by ID
 *   GET    /api/v1/user/:userId/chats — list all chats for a user
 *
 * Chat routes:
 *   POST   /api/v1/chat/create       — create or get a 1:1 chat
 *
 * Firebase message routes (Phase 2 — not yet implemented):
 *   POST   /api/v1/chat/:chatId/message/send
 *   GET    /api/v1/chat/:chatId/messages
 *   POST   /api/v1/chat/:chatId/message/:messageId/read
 *   POST   /api/v1/chat/:chatId/lastseen
 */

import { Router } from 'express';
import * as chatController from '../controllers/chatController';
import * as userController from '../controllers/userController';
import { validate } from '../middleware/validate';
import {
  createUserSchema,
  createChatSchema,
  userIdParamSchema,
} from '../validators/schemas';

const router = Router();

// ─── User Routes ─────────────────────────────────────────────────────────────

/**
 * POST /api/v1/user
 * Create a new user. Returns 201 with the generated userId.
 */
router.post(
  '/user',
  validate(createUserSchema, 'body'),
  userController.createUser
);

/**
 * GET /api/v1/user/:userId
 * Retrieve a user by UUID. Returns 404 if not found.
 */
router.get(
  '/user/:userId',
  validate(userIdParamSchema, 'params'),
  userController.getUserById
);

/**
 * GET /api/v1/user/:userId/chats
 * List all chats for a user, ordered by latest updated time.
 * Returns member IDs for each chat.
 */
router.get(
  '/user/:userId/chats',
  validate(userIdParamSchema, 'params'),
  chatController.getUserChats
);

// ─── Chat Routes ──────────────────────────────────────────────────────────────

/**
 * POST /api/v1/chat/create
 * Create or retrieve an existing 1:1 chat between two users.
 * Returns 201 if created, 200 if already exists.
 * Same chat is always returned regardless of userAId/userBId order.
 */
router.post(
  '/chat/create',
  validate(createChatSchema, 'body'),
  chatController.createChat
);

// ─── Future Firebase Routes (Phase 2 placeholder) ────────────────────────────
// router.post('/chat/:chatId/message/send',   ...);
// router.get('/chat/:chatId/messages',        ...);
// router.post('/chat/:chatId/message/:messageId/read', ...);
// router.post('/chat/:chatId/lastseen',       ...);

export default router;
