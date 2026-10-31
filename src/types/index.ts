/**
 * Shared TypeScript types and interfaces for the Chat Backend.
 * All types are strictly defined — no `any` allowed.
 *
 * Phase 1: MySQL only (Users + Chats).
 * Phase 2: Firebase Firestore types (messages, read receipts) will be added later.
 */

// ─── MySQL Models ────────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string | null;
  created_at: Date;
  updated_at: Date;
}

export type ChatType = 'ONE_TO_ONE';

export interface Chat {
  id: string;
  chat_type: ChatType;
  conversation_key: string;
  created_at: Date;
  updated_at: Date;
}

export interface ChatMember {
  id: number;
  chat_id: string;
  user_id: string;
  joined_at: Date;
}

// ─── User API ────────────────────────────────────────────────────────────────

export interface CreateUserRequest {
  id?: string;        // optional — server generates UUID if omitted
  name: string;
  email?: string;
}

export interface CreateUserResponse {
  success: true;
  userId: string;
  message: string;
}

// ─── Chat API ────────────────────────────────────────────────────────────────

/**
 * POST /chat/create
 */
export interface CreateChatRequest {
  userAId: string;
  userBId: string;
}

export interface CreateChatResponse {
  success: true;
  chatId: string;
  message: string;
}

/**
 * GET /user/:userId/chats  — one item in the response array
 */
export interface ChatListItem {
  chatId: string;
  chatType: ChatType;
  members: string[];
  createdAt: string;   // ISO 8601
}

export interface GetUserChatsResponse {
  success: true;
  chats: ChatListItem[];
}

// ─── Message API (Phase 2) ──────────────────────────────────────────────────

export interface SendMessageRequest {
  senderId: string;
  text: string;
}

export interface SendMessageData {
  messageId: string;
  chatId: string;
  senderId: string;
  text: string;
  timestamp: string;
}

export interface SendMessageResponse {
  success: true;
  message: string;
  messageId: string;
  data: SendMessageData;
}

// ─── Pagination ──────────────────────────────────────────────────────────────

export interface PaginationOptions {
  limit: number;
  before?: string;
}

// ─── Error ───────────────────────────────────────────────────────────────────

export interface ApiError {
  status: number;
  message: string;
  code?: string;
  details?: unknown;
}

// ─── Firestore Models (Phase 2 — not yet implemented) ────────────────────────
// These will be added when Firebase integration begins.

// export interface FirestoreMessage { ... }
// export interface FirestoreMessageInput { ... }
// export interface SendMessageRequest { ... }
// export interface SendMessageResponse { ... }
// export interface GetMessagesQuery { ... }
// export interface MessageResponse { ... }
// export interface GetMessagesResponse { ... }
// export interface ReadReceiptRequest { ... }
// export interface ReadReceiptResponse { ... }
// export interface LastSeenRequest { ... }
// export interface LastSeenResponse { ... }
