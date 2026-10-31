/**
 * Chat Controller — HTTP layer for chat endpoints.
 *
 * Responsibilities:
 *  - Extract and pass validated input to the service layer
 *  - Map service results to HTTP responses with correct status codes
 *  - Delegate all errors to Express error handler via next(err)
 *
 * No raw SQL, no business logic here.
 */

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';
import * as chatService from '../services/chatService';
import * as messageService from '../services/messageService';
import type {
  CreateChatRequest,
  SendMessageRequest,
  GetMessagesQuery,
  MarkMessageReadRequest,
  UpdateLastSeenRequest,
} from '../types';

// ─── POST /api/v1/chat/create ────────────────────────────────────────────────

/**
 * Create or retrieve an existing 1:1 chat between two users.
 *
 * Returns 201 if a new chat was created, 200 if one already existed.
 * The response always includes the chatId so the client can use it immediately.
 */
export async function createChat(
  req: Request<Record<string, never>, unknown, CreateChatRequest>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { userAId, userBId } = req.body;
    const result = await chatService.findOrCreateChat(userAId, userBId);

    // 201 for a brand-new chat; 200 for an existing one
    const isNew = result.message === 'Chat created successfully';
    res.status(isNew ? 201 : 200).json(result);
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/v1/user/:userId/chats ──────────────────────────────────────────

/**
 * List all chats for a user, ordered by most recently updated.
 */
export async function getUserChats(
  req: Request<{ userId: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { userId } = req.params;
    const chats = await chatService.getUserChats(userId);

    res.status(200).json({
      success: true,
      chats,
    });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/v1/chat/:chatId/message/send ─────────────────────────────────

/**
 * Send a message in a chat.
 * Verifies chat & sender membership in MySQL, then stores in Firestore.
 */
export async function sendMessage(
  req: Request<{ chatId: string }, unknown, SendMessageRequest>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { chatId } = req.params;
    const { senderId, text } = req.body;

    const result = await messageService.sendMessage(chatId, senderId, text);

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/v1/chat/:chatId/messages ───────────────────────────────────────

/**
 * Get messages from a chat with cursor-based pagination.
 * Verifies chat & requester membership in MySQL, then retrieves from Firestore.
 */
export async function getMessages(
  req: Request<{ chatId: string }, unknown, unknown, GetMessagesQuery>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { chatId } = req.params;
    const { limit = 50, cursor, before, userId } = req.query;

    const requesterId = userId || req.user?.id || (req.headers['x-user-id'] as string);
    if (!requesterId) {
      throw AppError.unauthorized(
        'userId query parameter or x-user-id header is required to verify chat membership'
      );
    }

    const result = await messageService.getMessages(chatId, requesterId, {
      limit: Number(limit),
      cursor: cursor || before,
    });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/v1/chat/:chatId/message/:messageId/read ───────────────────────

/**
 * Mark a message as read by a chat participant.
 * Verifies chat & participant membership in MySQL, message existence in Firestore,
 * and records the read receipt idempotently.
 */
export async function markMessageRead(
  req: Request<{ chatId: string; messageId: string }, unknown, MarkMessageReadRequest>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { chatId, messageId } = req.params;
    const { userId } = req.body;

    const result = await messageService.markMessageRead(chatId, messageId, userId);

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/v1/chat/:chatId/lastseen ──────────────────────────────────────

/**
 * Update the last seen message for a user in a chat.
 * Verifies chat & participant membership in MySQL, message existence in Firestore,
 * checks that message is not older than current last-seen, and updates lastSeen.
 */
export async function updateLastSeen(
  req: Request<{ chatId: string }, unknown, UpdateLastSeenRequest>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { chatId } = req.params;
    const { userId, messageId } = req.body;

    const result = await messageService.updateLastSeen(chatId, userId, messageId);

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
