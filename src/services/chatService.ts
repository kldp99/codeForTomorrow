/**
 * Chat Service — business logic layer for chat operations.
 *
 * This service coordinates between repositories and enforces business rules:
 *  - Both users must exist before creating a chat
 *  - A user cannot create a chat with themselves
 *  - Exactly one 1:1 chat can exist between two users (order-independent)
 *
 * The service does NOT contain raw SQL — all DB access goes through repositories.
 */

import { AppError } from '../utils/AppError';
import * as userRepo from '../repositories/userRepository';
import * as chatRepo from '../repositories/chatRepository';
import type {
  CreateChatResponse,
  ChatListItem,
} from '../types';

// ─── Create or Get Chat ───────────────────────────────────────────────────────

/**
 * Find or create a 1:1 chat between two users.
 *
 * Business rules enforced here:
 *  1. userAId !== userBId  (cannot chat with yourself)
 *  2. Both users must exist in the database
 *  3. If a chat already exists between them, return it (idempotent)
 *  4. Otherwise create a new chat + 2 membership rows in a transaction
 *
 * The conversation_key ensures the same chat is always returned regardless
 * of the order in which the user IDs are passed.
 */
export async function findOrCreateChat(
  userAId: string,
  userBId: string
): Promise<CreateChatResponse> {
  // Rule 1 — prevent self-chat (also validated by Joi, this is a safety net)
  if (userAId === userBId) {
    throw AppError.badRequest(
      'Cannot create a chat with yourself. userAId and userBId must be different.',
      'SELF_CHAT_NOT_ALLOWED'
    );
  }

  // Rule 2 — verify both users exist
  const missingIds = await userRepo.getMissingUserIds([userAId, userBId]);
  if (missingIds.length > 0) {
    throw AppError.notFound(`User(s) with id(s): ${missingIds.join(', ')}`);
  }

  // Rule 3 — check for an existing chat
  const conversationKey = chatRepo.buildConversationKey(userAId, userBId);
  const existingChat = await chatRepo.findChatByConversationKey(conversationKey);

  if (existingChat) {
    return {
      success: true,
      chatId:  existingChat.id,
      message: 'Chat retrieved successfully',
    };
  }

  // Rule 4 — create a new chat (with transaction)
  const newChat = await chatRepo.createChatWithMembers(
    userAId,
    userBId,
    conversationKey
  );

  return {
    success: true,
    chatId:  newChat.id,
    message: 'Chat created successfully',
  };
}

// ─── Get User Chats ───────────────────────────────────────────────────────────

/**
 * Return all chats for a user, ordered by most recently updated.
 * Each chat item includes the list of member user IDs.
 *
 * @throws AppError 404 if the user does not exist
 */
export async function getUserChats(userId: string): Promise<ChatListItem[]> {
  // Verify the user exists before querying their chats
  const exists = await userRepo.userExists(userId);
  if (!exists) {
    throw AppError.notFound(`User ${userId}`);
  }

  return chatRepo.getUserChatsWithMembers(userId);
}

// ─── Assert helpers (used by future routes / Firebase phase) ──────────────────

/**
 * Assert that a chat exists. Throws 404 if not found.
 */
export async function assertChatExists(chatId: string): Promise<void> {
  const chat = await chatRepo.findChatById(chatId);
  if (!chat) {
    throw AppError.notFound(`Chat ${chatId}`);
  }
}
